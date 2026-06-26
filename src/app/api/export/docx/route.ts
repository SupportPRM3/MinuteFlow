import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle
} from "docx";
import { MeetingMinutes, ActionItem } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { minutes } = await req.json() as { minutes: MeetingMinutes };

    const heading = (text: string) => new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    });

    const bullet = (text: string) => new Paragraph({
      text,
      bullet: { level: 0 },
      spacing: { after: 60 },
    });

    const body = (text: string) => new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      spacing: { after: 100 },
    });

    const divider = () => new Paragraph({
      text: "",
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } },
      spacing: { before: 100, after: 200 },
    });

    const actionTable = (items: ActionItem[]) => {
      if (!items?.length) return body("No action items identified.");
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Task", "Assignee", "Due Date", "Priority"].map((h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })],
                shading: { fill: "EEF2FF" },
              })
            ),
          }),
          ...items.map((item) => new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.task, size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.assignee || "—", size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.dueDate || "—", size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.priority || "—", size: 20 })] })] }),
            ],
          })),
        ],
      });
    };

    const doc = new Document({
      styles: {
        paragraphStyles: [{
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 22 },
        }],
      },
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        children: [
          // Title block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: minutes.title || "Meeting Minutes", bold: true, size: 36, color: "1E293B" })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${minutes.date}  ·  ${minutes.time}  ·  ${minutes.duration}`, size: 22, color: "64748B" }),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Participants: ${(minutes.participants ?? []).join(", ")}`, size: 22, color: "64748B" })],
            spacing: { after: 300 },
          }),
          divider(),

          // Objectives
          ...(minutes.objectives?.length ? [heading("Objectives"), ...minutes.objectives.map(bullet)] : []),

          // Agenda
          ...(minutes.agenda?.length ? [heading("Agenda"), ...minutes.agenda.map(bullet)] : []),

          // Discussion Summary
          heading("Discussion Summary"),
          body(minutes.discussionSummary || ""),

          // Decisions
          ...(minutes.decisions?.length ? [heading("Decisions Made"), ...minutes.decisions.map(bullet)] : []),

          // Action Items
          heading("Action Items"),
          actionTable(minutes.actionItems ?? []),

          // Risks
          ...(minutes.risks?.length ? [heading("Risks"), ...minutes.risks.map(bullet)] : []),

          // Follow-up
          ...(minutes.followUpItems?.length ? [heading("Follow-up Items"), ...minutes.followUpItems.map(bullet)] : []),

          // Next Meeting
          ...(minutes.nextMeeting ? [heading("Next Meeting"), body(minutes.nextMeeting)] : []),

          divider(),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `Prepared by: ${minutes.preparedBy || "MinuteFlow AI"}`, size: 18, italics: true, color: "94A3B8" })],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${(minutes.title || "meeting-minutes").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
