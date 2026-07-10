import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MeetingMinutes } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { minutes, request } = await req.json() as { minutes: MeetingMinutes; request: string };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      // Must comfortably exceed the size of a full minutes JSON — the model echoes back
      // the entire object, not a diff, and 4096 truncated mid-string on real meetings.
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `You are an expert executive assistant editing meeting minutes. Apply the user's requested change to the minutes JSON.

CURRENT MINUTES:
${JSON.stringify(minutes, null, 2)}

USER REQUEST: "${request}"

Apply the change and return the complete updated minutes as ONLY valid JSON (no markdown, no explanation).
Keep all existing fields. Only modify what the user asked to change.`,
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const updated = JSON.parse(jsonText);

    return NextResponse.json({ minutes: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
