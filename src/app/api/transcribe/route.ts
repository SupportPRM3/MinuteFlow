import { NextRequest } from "next/server";
import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, readdir, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { analyzeTranscript, enrichSegmentsWithSpeakers } from "@/lib/analyze-transcript";

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WHISPER_LIMIT_MB = 23;

// Compressing + transcribing a long recording with Whisper, then analyzing it with
// Claude, can comfortably exceed Vercel's default function timeout — which kills the
// request mid-stream with no "done" or "error" event ever sent. Raise the ceiling so
// large files have room to finish (300s is the Vercel Pro plan max without Fluid Compute).
export const maxDuration = 300;

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

      // Checkpoint: transcription is done and is the slow, expensive step. Send it to the
      // client now so it can be saved immediately — if the analysis step below fails or the
      // function gets killed, the transcript is not lost and analysis can be retried on it
      // later via /api/analyze instead of re-transcribing from scratch.
      await send("transcript", { transcript: segments });

      // Claude Sonnet's 200K-token context window comfortably fits multi-hour transcripts —
      // this is a safety cap for pathological inputs, not a normal-case limit.
      const MAX_TRANSCRIPT_CHARS = 300000;
      const transcriptForAI = fullText.length > MAX_TRANSCRIPT_CHARS
        ? fullText.slice(0, MAX_TRANSCRIPT_CHARS) + "\n\n[Transcript truncated for length]"
        : fullText;

      await send("progress", { stage: "analyzing", message: "Analyzing with Claude AI…", pct: 60 });
      const ai = await analyzeTranscript(transcriptForAI);
      await send("progress", { stage: "finalizing", message: "Finalizing meeting minutes…", pct: 90 });

      const enrichedSegments = enrichSegmentsWithSpeakers(segments, ai.speakers);

      await send("done", {
        transcript: enrichedSegments,
        speakers: ai.speakers,
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
