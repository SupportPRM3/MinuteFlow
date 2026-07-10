import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, Header, Footer, PageNumber, ImageRun,
  ShadingType,
} from "docx";
import { MeetingMinutes, ActionItem } from "@/lib/types";
import { BrandingSettings } from "@/store/branding";

// Convert hex color to docx format (no #)
function hex(color: string) { return color.replace("#", ""); }

// Minutes list/text fields are normally plain strings, but AI-generated data occasionally
// nests a malformed object instead — coerce so docx's TextRun never receives a non-string.
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const strings = Object.values(value).filter((v) => typeof v === "string");
    return strings.length ? strings.join(" — ") : JSON.stringify(value);
  }
  return String(value);
}

// Fetch a remote image or decode base64 to a Buffer
async function resolveImage(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("data:")) {
      const base64 = src.split(",")[1];
      return Buffer.from(base64, "base64");
    }
    const res = await fetch(src);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { minutes, branding } = await req.json() as {
      minutes: MeetingMinutes;
      branding?: BrandingSettings;
    };

    const accent = hex(branding?.accentColor ?? "#6366f1");
    const company = branding?.companyName || "MinuteFlow";
    const tagline = branding?.tagline || "";
    const footerNote = branding?.footerNote || "Confidential – for internal use only";
    const contactLine = [branding?.website, branding?.email, branding?.phone].filter(Boolean).join("  ·  ");
    const preparedBy = branding?.preparedBy || "MinuteFlow AI";

    // Resolve logo image if provided
    let logoBuffer: Buffer | null = null;
    if (branding?.logoBase64) {
      logoBuffer = await resolveImage(branding.logoBase64);
    }

    // ── Helper builders ───────────────────────────────────────────────────
    const heading = (text: string) => new Paragraph({
      children: [new TextRun({ text, bold: true, size: 26, color: accent })],
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accent, space: 4 } },
    });

    const bullet = (text: string) => new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text: asText(text), size: 21 })],
      spacing: { after: 60 },
    });

    const body = (text: string) => new Paragraph({
      children: [new TextRun({ text: asText(text), size: 21 })],
      spacing: { after: 100 },
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
                shading: { type: ShadingType.SOLID, fill: accent, color: accent },
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 19, color: "FFFFFF" })] })],
              })
            ),
          }),
          ...items.map((item) => new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.task, size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.assignee || "—", size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.dueDate || "—", size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.priority || "—", size: 20, bold: item.priority === "high" })] })] }),
            ],
          })),
        ],
      });
    };

    // ── Header ────────────────────────────────────────────────────────────
    const headerChildren: Paragraph[] = [];

    if (logoBuffer) {
      headerChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 160, height: 48 },
              type: "png",
            }),
          ],
          spacing: { after: 40 },
        })
      );
    } else {
      // Text-based logo fallback
      headerChildren.push(
        new Paragraph({
          children: [new TextRun({ text: company, bold: true, size: 28, color: accent })],
          spacing: { after: tagline ? 20 : 60 },
        })
      );
    }

    if (tagline) {
      headerChildren.push(
        new Paragraph({
          children: [new TextRun({ text: tagline, size: 18, color: "64748B", italics: true })],
          spacing: { after: 60 },
        })
      );
    }

    // Accent rule under header
    headerChildren.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent } },
        spacing: { after: 0 },
        children: [],
      })
    );

    // ── Footer ────────────────────────────────────────────────────────────
    const footerChildren: Paragraph[] = [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } },
        spacing: { before: 80 },
        children: [],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: footerNote + "    ", size: 17, color: "94A3B8" }),
          ...(contactLine ? [new TextRun({ text: contactLine + "    ", size: 17, color: "94A3B8" })] : []),
          new TextRun({ children: [PageNumber.CURRENT], size: 17, color: "94A3B8" }),
          new TextRun({ text: " / ", size: 17, color: "94A3B8" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: "94A3B8" }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
    ];

    // ── Document body ─────────────────────────────────────────────────────
    const doc = new Document({
      styles: {
        paragraphStyles: [{
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 22 },
        }],
      },
      sections: [{
        headers: { default: new Header({ children: headerChildren }) },
        footers: { default: new Footer({ children: footerChildren }) },
        properties: {
          page: { margin: { top: 1200, bottom: 900, left: 1200, right: 1200 } },
        },
        children: [
          // Title block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: minutes.title || "Meeting Minutes", bold: true, size: 38, color: "1E293B" })],
            spacing: { after: 160 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            shading: { type: ShadingType.SOLID, fill: "F8FAFC" },
            children: [
              new TextRun({ text: minutes.date, size: 21, color: "475569" }),
              new TextRun({ text: "  ·  ", size: 21, color: "CBD5E1" }),
              new TextRun({ text: minutes.time, size: 21, color: "475569" }),
              new TextRun({ text: "  ·  ", size: 21, color: "CBD5E1" }),
              new TextRun({ text: minutes.duration, size: 21, color: "475569" }),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Participants: ", bold: true, size: 21, color: "475569" }),
              new TextRun({ text: (minutes.participants ?? []).join(", "), size: 21, color: "475569" }),
            ],
            spacing: { after: 320 },
          }),

          ...(minutes.objectives?.length ? [heading("Objectives"), ...minutes.objectives.map(bullet)] : []),
          ...(minutes.agenda?.length ? [heading("Agenda"), ...minutes.agenda.map(bullet)] : []),

          heading("Discussion Summary"),
          body(minutes.discussionSummary || ""),

          ...(minutes.decisions?.length ? [heading("Decisions Made"), ...minutes.decisions.map(bullet)] : []),

          heading("Action Items"),
          actionTable(minutes.actionItems ?? []),

          ...(minutes.risks?.length ? [heading("Risks & Considerations"), ...minutes.risks.map(bullet)] : []),
          ...(minutes.followUpItems?.length ? [heading("Follow-up Items"), ...minutes.followUpItems.map(bullet)] : []),
          ...(minutes.nextMeeting ? [heading("Next Meeting"), body(minutes.nextMeeting)] : []),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
            children: [new TextRun({ text: `Prepared by: ${preparedBy}`, size: 18, italics: true, color: "94A3B8" })],
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
