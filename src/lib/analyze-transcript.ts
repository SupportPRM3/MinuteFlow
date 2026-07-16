import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AnalyzedMinutes {
  title: string;
  date: string;
  time: string;
  duration: string;
  participants: string[];
  objectives: string[];
  agenda: string[];
  discussionSummary: string;
  decisions: string[];
  actionItems: unknown[];
  risks: string[];
  followUpItems: string[];
  nextMeeting?: string | null;
  preparedBy: string;
}

export interface AnalysisResult {
  speakers: Array<{ id: string; name: string; color: string }>;
  title: string;
  participants: string[];
  summaries: Record<string, string>;
  actionItems: Array<Record<string, unknown>>;
  minutes: AnalyzedMinutes;
}

// The model is prompted to return these as arrays of plain strings, but occasionally
// nests a malformed object instead — coerce here so the client never has to guard
// against non-string children when rendering (React throws on object children).
function asText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const strings = Object.values(item).filter((v) => typeof v === "string");
    return strings.length ? strings.join(" — ") : JSON.stringify(item);
  }
  return String(item);
}

// Single Claude call covering both the analysis and the meeting minutes —
// avoids sending the (often large) transcript twice. Shared by the initial
// transcribe pipeline and the standalone retry-analysis endpoint so both
// paths produce identical output.
export async function analyzeTranscript(transcriptForAI: string): Promise<AnalysisResult> {
  // Force the year to 2026 — the server clock's real year lags behind, which was
  // showing up as "2025" on newly generated minutes.
  const now = new Date();
  now.setFullYear(2026);
  const today = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const nowTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

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

  const raw = call.content[0].type === "text" ? call.content[0].text : "";
  const json = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const ai = JSON.parse(json);

  ai.minutes.actionItems = ai.actionItems ?? [];

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

  ai.speakers = ai.speakers ?? [{ id: "s1", name: "Speaker 1", color: "#6366f1" }];

  return ai as AnalysisResult;
}

// Assigns each transcript segment to a speaker — matched by name mention, falling
// back to a round-robin split so every segment always ends up with a speakerId.
export function enrichSegmentsWithSpeakers<T extends { text: string; speakerId: string }>(
  segments: T[],
  speakers: Array<{ id: string; name: string; color: string }>
): T[] {
  return segments.map((seg, idx) => {
    const matchedSpeaker = speakers.find((sp) =>
      seg.text.toLowerCase().includes(sp.name.toLowerCase().split(" ")[0])
    );
    const fallbackSpeaker = speakers[Math.floor(idx / 3) % speakers.length];
    return { ...seg, speakerId: (matchedSpeaker ?? fallbackSpeaker ?? speakers[0]).id };
  });
}
