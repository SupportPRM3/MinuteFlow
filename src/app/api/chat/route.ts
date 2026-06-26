import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, transcript, minutes, actionItems } = await req.json();

    const context = `
MEETING TRANSCRIPT:
${transcript?.map((s: { startTime: number; text: string }) => `[${s.startTime}s] ${s.text}`).join("\n") ?? "No transcript available"}

DISCUSSION SUMMARY:
${minutes?.discussionSummary ?? "Not available"}

DECISIONS:
${minutes?.decisions?.join("\n") ?? "None"}

ACTION ITEMS:
${actionItems?.map((a: { task: string; assignee: string; dueDate?: string }) => `- ${a.task} (${a.assignee}${a.dueDate ? `, due ${a.dueDate}` : ""})`).join("\n") ?? "None"}
`.trim();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: "You are a helpful meeting assistant. Answer questions about the meeting using ONLY the provided context. Be concise and specific. Use markdown formatting for lists and bold text where helpful.",
      messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
    });

    const answer = message.content[0].type === "text" ? message.content[0].text : "Unable to process.";
    return NextResponse.json({ answer });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
