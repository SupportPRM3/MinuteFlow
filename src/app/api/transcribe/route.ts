import { NextRequest } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, readdir, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WHISPER_LIMIT_MB = 23;

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(ffmpegPath as string, args);
}

async function compressAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    "-i", inputPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", "-f", "mp3", "-y", outputPath,
  ]);
}

async function splitAudio(inputPath: string, chunkDir: string, chunkDurationSec: number): Promise<string[]> {
  await runFfmpeg([
    "-i", inputPath, "-f", "segment", "-segment_time", String(chunkDurationSec),
    "-c", "copy", "-y", join(chunkDir, "chunk_%03d.mp3"),
  ]);
  return (await readdir(chunkDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
    .sort()
    .map((f) => join(chunkDir, f));
}

async function transcribeFile(
  filePath: string,
  filename: string
): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
  const buffer = await readFile(filePath);
  const file = new File([buffer], filename, { type: "audio/mpeg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });
  return { text: result.text, segments: result.segments ?? [] };
}

// Server-Sent Events helper
function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];
  const tempDirs: string[] = [];

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(sseMessage(event, data)));
  };

  // Run pipeline in background and stream progress
  (async () => {
    try {
      const { fileUrl, filename } = await req.json();
      if (!fileUrl || !filename) {
        await send("error", { message: "No file provided" });
        return;
      }

      const tmp = tmpdir();
      const ext = filename.split(".").pop() ?? "m4a";
      const inputPath = join(tmp, `mf-input-${Date.now()}.${ext}`);
      const compressedPath = join(tmp, `mf-compressed-${Date.now()}.mp3`);
      tempFiles.push(inputPath, compressedPath);

      await send("progress", { stage: "compressing", message: "Compressing audio…", pct: 10 });
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) throw new Error(`Failed to download uploaded file (${fileRes.status})`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      await writeFile(inputPath, buffer);
      await compressAudio(inputPath, compressedPath);

      await send("progress", { stage: "transcribing", message: "Transcribing with Whisper AI…", pct: 30 });
      const compressedBuffer = await readFile(compressedPath);
      const compressedMB = compressedBuffer.byteLength / (1024 * 1024);

      let fullText = "";
      const allSegments: Array<{ start: number; end: number; text: string }> = [];

      if (compressedMB <= WHISPER_LIMIT_MB) {
        const result = await transcribeFile(compressedPath, "audio.mp3");
        fullText = result.text;
        allSegments.push(...result.segments);
      } else {
        const chunkDir = join(tmp, `mf-chunks-${Date.now()}`);
        await mkdir(chunkDir, { recursive: true });
        tempDirs.push(chunkDir);
        const chunkPaths = await splitAudio(compressedPath, chunkDir, 1200);

        let timeOffset = 0;
        for (let i = 0; i < chunkPaths.length; i++) {
          await send("progress", {
            stage: "transcribing",
            message: `Transcribing part ${i + 1} of ${chunkPaths.length}…`,
            pct: 30 + Math.round((i / chunkPaths.length) * 25),
          });
          const result = await transcribeFile(chunkPaths[i], `chunk-${i}.mp3`);
          for (const seg of result.segments) {
            allSegments.push({ start: seg.start + timeOffset, end: seg.end + timeOffset, text: seg.text });
          }
          fullText += (fullText ? " " : "") + result.text;
          timeOffset += result.segments.length > 0
            ? result.segments[result.segments.length - 1].end
            : 1200;
          tempFiles.push(chunkPaths[i]);
        }
      }

      const segments = allSegments.map((seg, i) => ({
        id: `seg-${i}`,
        speakerId: "s1",
        startTime: Math.round(seg.start),
        endTime: Math.round(seg.end),
        text: seg.text.trim(),
      }));

      // Claude Sonnet's 200K-token context window comfortably fits multi-hour transcripts —
      // this is a safety cap for pathological inputs, not a normal-case limit.
      const MAX_TRANSCRIPT_CHARS = 300000;
      const transcriptForAI = fullText.length > MAX_TRANSCRIPT_CHARS
        ? fullText.slice(0, MAX_TRANSCRIPT_CHARS) + "\n\n[Transcript truncated for length]"
        : fullText;

      // Force the year to 2026 — the server clock's real year lags behind, which was
      // showing up as "2025" on newly generated minutes.
      const now = new Date();
      now.setFullYear(2026);
      const today = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const nowTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      // Single Claude call covering both the analysis and the meeting minutes —
      // avoids sending the (often large) transcript twice.
      await send("progress", { stage: "analyzing", message: "Analyzing with Claude AI…", pct: 60 });

      const call = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        messages: [{
          role: "user",
          content: `You are an expert meeting assistant and executive assistant. Analyze this transcript and produce both a structured analysis and professional meeting minutes. Return ONLY valid JSON (no markdown, no code fences).

The transcript may cover many distinct topics, including brief or minor ones. It is critical that EVERY topic discussed is represented — in the summaries, the minutes' agenda, and the discussion narrative — do not skip, merge, or drop any topic just to keep things short.

TRANSCRIPT:
${transcriptForAI}

Return this JSON:
{
  "speakers": [{"id":"s1","name":"Speaker Name or Speaker 1","color":"#6366f1"}],
  "title": "Short meeting title (max 8 words)",
  "participants": ["name1","name2"],
  "summaries": {
    "executive": "2-3 sentence executive summary covering the full scope of topics discussed",
    "bullet": "• Key point 1\\n• Key point 2\\n• Key point 3 (one bullet per distinct topic — add as many bullets as there are topics, don't cap it at 3)",
    "detailed": "One paragraph per distinct topic discussed — do not omit any topic",
    "oneSentence": "One sentence",
    "clientFriendly": "Client-appropriate summary covering every topic discussed",
    "management": "Management-focused summary covering every topic discussed"
  },
  "actionItems": [{"id":"a1","task":"...","assignee":"...","dueDate":"YYYY-MM-DD or null","priority":"high|medium|low","status":"open","notes":""}],
  "minutes": {
    "title": "Full meeting title",
    "date": "${today}",
    "time": "${nowTime}",
    "duration": "estimate from transcript length",
    "participants": ["name1"],
    "objectives": ["objective1"],
    "agenda": ["one entry per distinct topic discussed — list every topic, even briefly mentioned ones, in the order they came up"],
    "discussionSummary": "Write one clear paragraph per topic in the agenda, covering it fully — not a transcript copy, but a coherent narrative of what was discussed. The number of paragraphs should match the number of topics actually discussed; do not cap it at 3-5 if more topics were covered.",
    "decisions": ["decision made"],
    "risks": ["risk identified"],
    "followUpItems": ["follow-up item"],
    "nextMeeting": null,
    "preparedBy": "MinuteFlow AI"
  }
}

Speaker colors (pick in order): ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4"]
Use "Speaker 1", "Speaker 2" etc. if names are unknown.`,
        }],
      });

      await send("progress", { stage: "finalizing", message: "Finalizing meeting minutes…", pct: 90 });

      const raw = call.content[0].type === "text" ? call.content[0].text : "";
      const json = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const ai = JSON.parse(json);

      ai.minutes.actionItems = ai.actionItems ?? [];

      // The model is prompted to return these as arrays of plain strings, but occasionally
      // nests a malformed object instead — coerce here so the client never has to guard
      // against non-string children when rendering (React throws on object children).
      const asText = (item: unknown): string => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const strings = Object.values(item).filter((v) => typeof v === "string");
          return strings.length ? strings.join(" — ") : JSON.stringify(item);
        }
        return String(item);
      };
      for (const field of ["objectives", "agenda", "decisions", "risks", "followUpItems"] as const) {
        const value = ai.minutes[field];
        if (!Array.isArray(value)) continue;
        ai.minutes[field] = value.map(asText);
      }
      // nextMeeting is prompted as a string or null, but the model occasionally nests a
      // structured "next meeting details" object here instead — same non-string crash risk.
      if (ai.minutes.nextMeeting != null && typeof ai.minutes.nextMeeting !== "string") {
        ai.minutes.nextMeeting = asText(ai.minutes.nextMeeting);
      }

      const speakers: Array<{ id: string; name: string; color: string }> = ai.speakers ?? [{ id: "s1", name: "Speaker 1", color: "#6366f1" }];
      const enrichedSegments = segments.map((seg, idx) => {
        const matchedSpeaker = speakers.find((sp) =>
          seg.text.toLowerCase().includes(sp.name.toLowerCase().split(" ")[0])
        );
        const fallbackSpeaker = speakers[Math.floor(idx / 3) % speakers.length];
        return { ...seg, speakerId: (matchedSpeaker ?? fallbackSpeaker ?? speakers[0]).id };
      });

      await send("done", {
        transcript: enrichedSegments,
        speakers: ai.speakers ?? [{ id: "s1", name: "Speaker 1", color: "#6366f1" }],
        title: ai.title ?? "Untitled Meeting",
        participants: ai.participants ?? ["Speaker 1"],
        summaries: ai.summaries,
        actionItems: ai.actionItems ?? [],
        minutes: ai.minutes,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Processing failed";
      await send("error", { message: msg });
    } finally {
      for (const f of tempFiles) await unlink(f).catch(() => {});
      for (const d of tempDirs) await rm(d, { recursive: true, force: true }).catch(() => {});
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
