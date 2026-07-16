// Shared client-side helper for calling /api/transcribe and parsing its SSE
// stream — used by both the Upload and Record pages so they stay in sync.
export type ProgressCallback = (stage: string, message: string, pct: number) => void;
// Fires once transcription finishes, before AI analysis starts — the caller should
// persist the transcript right away so it isn't lost if analysis fails afterward.
export type TranscriptCallback = (transcript: Record<string, unknown>[]) => void;

export async function runTranscription(
  fileUrl: string,
  filename: string,
  onProgress: ProgressCallback,
  onTranscript?: TranscriptCallback
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileUrl, filename }),
  });
  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData: Record<string, unknown> | null = null;

  while (true) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE messages — each message is separated by double newline
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const eventLine = part.match(/^event: (.+)$/m)?.[1];
      const dataLine = part.match(/^data: (.+)$/m)?.[1];
      if (!eventLine || !dataLine) continue;

      const payload = JSON.parse(dataLine);

      if (eventLine === "progress") {
        onProgress(payload.stage, payload.message, payload.pct);
      } else if (eventLine === "transcript") {
        onTranscript?.(payload.transcript);
      } else if (eventLine === "done") {
        finalData = payload;
      } else if (eventLine === "error") {
        throw new Error(payload.message);
      }
    }
  }

  if (!finalData) throw new Error("Processing failed — no data received.");
  return finalData;
}
