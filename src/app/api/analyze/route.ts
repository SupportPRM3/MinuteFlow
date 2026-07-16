import { NextRequest, NextResponse } from "next/server";
import { analyzeTranscript, enrichSegmentsWithSpeakers } from "@/lib/analyze-transcript";

// A single Claude call is fast enough to stay well under the default timeout,
// but keep some headroom for long transcripts.
export const maxDuration = 120;

interface TranscriptSegmentInput {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
}

// Re-runs just the AI-analysis step (speakers, summaries, action items, minutes) on a
// transcript that was already transcribed and saved. Lets a meeting whose analysis step
// failed pick back up from its saved transcript instead of re-transcribing from scratch.
export async function POST(req: NextRequest) {
  try {
    const { transcript } = (await req.json()) as { transcript?: TranscriptSegmentInput[] };
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const fullText = transcript.map((seg) => seg.text).join(" ");
    const ai = await analyzeTranscript(fullText);
    const enrichedSegments = enrichSegmentsWithSpeakers(transcript, ai.speakers);

    return NextResponse.json({
      transcript: enrichedSegments,
      speakers: ai.speakers,
      title: ai.title ?? "Untitled Meeting",
      participants: ai.participants ?? ["Speaker 1"],
      summaries: ai.summaries,
      actionItems: ai.actionItems ?? [],
      minutes: ai.minutes,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
