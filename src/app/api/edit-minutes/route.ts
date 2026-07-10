import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MeetingMinutes } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Minutes list/text fields are normally plain strings, but AI-generated data occasionally
// nests a malformed object instead — coerce so the client never has to guard against
// non-string children when rendering (React throws on object children).
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const strings = Object.values(value).filter((v) => typeof v === "string");
    return strings.length ? strings.join(" — ") : JSON.stringify(value);
  }
  return String(value);
}

const LIST_FIELDS = ["objectives", "agenda", "decisions", "risks", "followUpItems"] as const;

export async function POST(req: NextRequest) {
  try {
    const { minutes, request } = await req.json() as { minutes: MeetingMinutes; request: string };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      // Only a patch of the changed fields is generated now (not the whole document), so
      // this only needs headroom for the largest single field (e.g. a rewritten summary).
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `You are an expert executive assistant editing meeting minutes. Apply the user's requested change.

CURRENT MINUTES:
${JSON.stringify(minutes, null, 2)}

USER REQUEST: "${request}"

Return ONLY a JSON object containing the fields that need to change — omit every field that stays the same.
If a field is a list (e.g. participants, objectives, agenda, decisions, risks, followUpItems, actionItems) and
the request affects it, return that field's COMPLETE updated array (not just the added/changed item).
Return ONLY valid JSON (no markdown, no explanation, no unchanged fields).`,
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const patch = JSON.parse(jsonText);

    for (const field of LIST_FIELDS) {
      if (Array.isArray(patch[field])) patch[field] = patch[field].map(asText);
    }
    if (patch.nextMeeting != null && typeof patch.nextMeeting !== "string") {
      patch.nextMeeting = asText(patch.nextMeeting);
    }

    return NextResponse.json({ minutes: { ...minutes, ...patch } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
