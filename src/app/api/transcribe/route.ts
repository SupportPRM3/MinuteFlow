import { NextRequest, NextResponse } from "next/server";
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

const WHISPER_LIMIT_MB = 23; // MB, safely under Whisper's 25 MB cap

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(ffmpegPath as string, args);
}

// Convert any audio/video to mono MP3 at 64kbps (ideal for speech, ~0.48 MB/min)
async function compressAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    "-i", inputPath,
    "-vn",           // no video
    "-ar", "16000",  // 16kHz sample rate (Whisper's native rate)
    "-ac", "1",      // mono
    "-b:a", "64k",   // 64kbps — great for speech
    "-f", "mp3",
    "-y",            // overwrite
    outputPath,
  ]);
}

// Split a large MP3 into timed chunks (in seconds)
async function splitAudio(inputPath: string, chunkDir: string, chunkDurationSec: number): Promise<string[]> {
  await runFfmpeg([
    "-i", inputPath,
    "-f", "segment",
    "-segment_time", String(chunkDurationSec),
    "-c", "copy",
    "-y",
    join(chunkDir, "chunk_%03d.mp3"),
  ]);
  const files = (await readdir(chunkDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
    .sort()
    .map((f) => join(chunkDir, f));
  return files;
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

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];
  const tempDirs: string[] = [];

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const tmp = tmpdir();
    const ext = file.name.split(".").pop() ?? "m4a";
    const inputPath = join(tmp, `mf-input-${Date.now()}.${ext}`);
    const compressedPath = join(tmp, `mf-compressed-${Date.now()}.mp3`);
    tempFiles.push(inputPath, compressedPath);

    // Write uploaded file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Step 1: Compress to 64kbps mono MP3 (Whisper-optimized)
    await compressAudio(inputPath, compressedPath);

    // Step 2: Check if compressed file fits in one Whisper call
    const compressedBuffer = await readFile(compressedPath);
    const compressedMB = compressedBuffer.byteLength / (1024 * 1024);

    let fullText = "";
    const allSegments: Array<{ start: number; end: number; text: string }> = [];

    if (compressedMB <= WHISPER_LIMIT_MB) {
      // Small enough — single transcription call
      const result = await transcribeFile(compressedPath, "audio.mp3");
      fullText = result.text;
      allSegments.push(...result.segments);
    } else {
      // Split into timed chunks (~20 min each)
      const chunkDir = join(tmp, `mf-chunks-${Date.now()}`);
      await mkdir(chunkDir, { recursive: true });
      tempDirs.push(chunkDir);

      const chunkSec = 1200; // 20 minutes per chunk
      const chunkPaths = await splitAudio(compressedPath, chunkDir, chunkSec);

      let timeOffset = 0;
      for (let i = 0; i < chunkPaths.length; i++) {
        const result = await transcribeFile(chunkPaths[i], `chunk-${i}.mp3`);
        for (const seg of result.segments) {
          allSegments.push({ start: seg.start + timeOffset, end: seg.end + timeOffset, text: seg.text });
        }
        fullText += (fullText ? " " : "") + result.text;
        if (result.segments.length > 0) {
          timeOffset += result.segments[result.segments.length - 1].end;
        } else {
          timeOffset += chunkSec;
        }
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

    // Step 3: Two focused Claude calls to avoid token limits

    // Truncate transcript for Claude if very long (keep ~12,000 chars ≈ 8,000 words)
    const MAX_TRANSCRIPT_CHARS = 12000;
    const transcriptForAI = fullText.length > MAX_TRANSCRIPT_CHARS
      ? fullText.slice(0, MAX_TRANSCRIPT_CHARS) + "\n\n[Transcript truncated for length — see full transcript above]"
      : fullText;

    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    // Call 1: Metadata, speakers, summaries, action items
    // NOTE: No speakerSegments — too large for long meetings. Speakers assigned by name-matching below.
    const call1 = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are an expert meeting assistant. Analyze this transcript and return ONLY valid JSON (no markdown, no code fences).

TRANSCRIPT:
${transcriptForAI}

Return this JSON:
{
  "speakers": [{"id":"s1","name":"Speaker Name or Speaker 1","color":"#6366f1"}],
  "title": "Short meeting title (max 8 words)",
  "participants": ["name1","name2"],
  "summaries": {
    "executive": "2-3 sentence executive summary",
    "bullet": "• Key point 1\\n• Key point 2\\n• Key point 3",
    "detailed": "2-3 paragraph summary",
    "oneSentence": "One sentence",
    "clientFriendly": "Client-appropriate summary",
    "management": "Management-focused summary"
  },
  "actionItems": [{"id":"a1","task":"...","assignee":"...","dueDate":"YYYY-MM-DD or null","priority":"high|medium|low","status":"open","notes":""}]
}

Speaker colors (pick in order): ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4"]
Use "Speaker 1", "Speaker 2" etc. if names are unknown.`,
      }],
    });

    const raw1 = call1.content[0].type === "text" ? call1.content[0].text : "";
    const json1 = raw1.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const ai1 = JSON.parse(json1);

    // Call 2: Full meeting minutes
    const call2 = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      messages: [{
        role: "user",
        content: `You are an expert executive assistant. Write professional meeting minutes based on this transcript.

TRANSCRIPT:
${transcriptForAI}

PARTICIPANTS: ${(ai1.participants ?? ["Unknown"]).join(", ")}
ACTION ITEMS ALREADY IDENTIFIED: ${JSON.stringify(ai1.actionItems ?? [])}

Return ONLY valid JSON (no markdown):
{
  "title": "Full meeting title",
  "date": "${today}",
  "time": "${nowTime}",
  "duration": "estimate from transcript length",
  "participants": ["name1"],
  "objectives": ["objective1"],
  "agenda": ["agenda item"],
  "discussionSummary": "Write 3-5 paragraphs as a professional executive assistant would — not a transcript copy, but a coherent narrative of what was discussed",
  "decisions": ["decision made"],
  "risks": ["risk identified"],
  "followUpItems": ["follow-up item"],
  "nextMeeting": null,
  "preparedBy": "MinuteFlow AI"
}`,
      }],
    });

    const raw2 = call2.content[0].type === "text" ? call2.content[0].text : "";
    const json2 = raw2.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const ai2 = JSON.parse(json2);

    // Merge action items into minutes
    ai2.actionItems = ai1.actionItems ?? [];

    // Assign speakers by matching speaker names found in each segment's text.
    // Whisper sometimes prepends "[Name]:" or the text references the speaker.
    // Fallback: round-robin across detected speakers (reasonable for multi-speaker meetings).
    const speakers: Array<{ id: string; name: string; color: string }> = ai1.speakers ?? [{ id: "s1", name: "Speaker 1", color: "#6366f1" }];
    const enrichedSegments = segments.map((seg, idx) => {
      // Try to match a speaker name in the segment text
      const matchedSpeaker = speakers.find((sp) =>
        seg.text.toLowerCase().includes(sp.name.toLowerCase().split(" ")[0])
      );
      // Fallback: alternate speakers based on natural conversation flow (every ~3 segments)
      const fallbackSpeaker = speakers[Math.floor(idx / 3) % speakers.length];
      return {
        ...seg,
        speakerId: (matchedSpeaker ?? fallbackSpeaker ?? speakers[0]).id,
      };
    });

    return NextResponse.json({
      transcript: enrichedSegments,
      speakers: ai1.speakers ?? [{ id: "s1", name: "Speaker 1", color: "#6366f1" }],
      title: ai1.title ?? "Untitled Meeting",
      participants: ai1.participants ?? ["Speaker 1"],
      summaries: ai1.summaries,
      actionItems: ai1.actionItems ?? [],
      minutes: ai2,
    });
  } catch (error) {
    console.error("Processing error:", error);
    const msg = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Clean up temp files
    for (const f of tempFiles) {
      await unlink(f).catch(() => {});
    }
    for (const d of tempDirs) {
      await rm(d, { recursive: true, force: true }).catch(() => {});
    }
  }
}
