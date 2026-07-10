"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Star, Download, Share2, Edit2, Check, X,
  FileText, MessageSquare, CheckSquare, Users, Clock, Calendar,
  ChevronRight, Send, Sparkles, Copy, MoreHorizontal, Loader2,
  Wand2, FileDown, FileText as FileTextIcon, PenLine
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMeetingsStore } from "@/store/meetings";
import { useAuthStore } from "@/store/auth";
import { useBrandingStore } from "@/store/branding";
import { formatDuration, formatTimestamp, formatDate, cn } from "@/lib/utils";
import { ChatMessage, MeetingMinutes } from "@/lib/types";

type Tab = "transcript" | "minutes" | "summary" | "actions" | "ai-chat";

// Minutes list fields are normally plain strings, but AI-generated data occasionally
// nests a malformed object instead — coerce so React never throws rendering a non-string child.
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const strings = Object.values(value).filter((v) => typeof v === "string");
    return strings.length ? strings.join(" — ") : JSON.stringify(value);
  }
  return String(value);
}

const MOCK_AI_RESPONSES: Record<string, string> = {
  default: "Based on this meeting's transcript, I can help you find specific information. Try asking about decisions made, action items assigned to someone, topics discussed, or any specific details from the conversation.",
  decisions: "**Decisions made in this meeting:**\n\n1. Maximum authorized discount for the Hartmann multi-year deal is 10%, pending a finance scenario analysis\n2. Finance analysis must be completed before any commitment is made to Hartmann\n3. Chicago office upsell discussion deferred to a subsequent meeting",
  actions: "**Action items from this meeting:**\n\n• **Sarah Chen** — Prepare 3-scenario discount analysis (8%, 10%, 12%) — Due June 27\n• **Jovit Aleria** — Follow-up call with Hartmann CFO — Due June 30\n• **Mike Johnson** — Research Chicago office upsell opportunity — Due July 3",
  hartmann: "**Hartmann Account Discussion:**\n\nThe Hartmann account is in renewal discussions. Key points:\n- The client's CFO expressed interest in a multi-year deal\n- They are requesting a **12% discount** on years 2 and 3\n- The internal team agreed on a **maximum 10% authorization**\n- A finance scenario analysis is required before final commitment\n- Follow-up with their CFO is scheduled for Monday",
};

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meetings, toggleFavorite, updateTranscriptSegment, renameSpeaker, updateActionItem, updateMinutes } = useMeetingsStore();
  const { branding } = useBrandingStore();
  const userId = useAuthStore((s) => s.user?.id);
  const meeting = meetings.find((m) => m.id === id);
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [speakerName, setSpeakerName] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: MOCK_AI_RESPONSES.default, timestamp: new Date() }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeSummaryType, setActiveSummaryType] = useState<"executive" | "bullet" | "detailed" | "oneSentence" | "clientFriendly" | "management">("executive");
  const [chatLoading, setChatLoading] = useState(false);
  const msgCounter = useRef(100);
  // Persisted audio recording
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  useEffect(() => {
    if (!userId) return;
    import("@/lib/audio-storage").then(({ loadRecording }) =>
      loadRecording(id, userId).then((r) => {
        if (r) { setAudioUrl(r.url); setAudioName(r.name); }
      }).catch(() => {})
    );
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  // Minutes AI editing
  const [minutesData, setMinutesData] = useState<MeetingMinutes | null | undefined>(undefined);
  const [editRequest, setEditRequest] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  // Ref always tracks the latest active minutes so export closures never go stale
  const activeMinutesRef = useRef<MeetingMinutes | null | undefined>(undefined);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Keep ref current before any early return so export handlers never use a stale closure
  const activeMinutesEarly = minutesData !== undefined ? minutesData : meeting?.minutes;
  useEffect(() => {
    activeMinutesRef.current = activeMinutesEarly;
  });

  if (!meeting) return (
    <div className="p-8 text-center">
      <p className="text-slate-500">Meeting not found.</p>
      <Link href="/meetings"><Button variant="outline" className="mt-4">Back to Library</Button></Link>
    </div>
  );

  const getSpeaker = (speakerId: string) => meeting.speakers?.find((s) => s.id === speakerId);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput;
    const userMsg: ChatMessage = { id: String(++msgCounter.current), role: "user", content: question, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          transcript: meeting.transcript,
          minutes: meeting.minutes,
          actionItems: meeting.actionItems,
        }),
      });
      const data = await res.json();
      const answer = data.answer ?? data.error ?? "Sorry, I couldn't process that.";
      const aiMsg: ChatMessage = { id: String(++msgCounter.current), role: "assistant", content: answer, timestamp: new Date() };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = { id: String(++msgCounter.current), role: "assistant", content: "Connection error. Please try again.", timestamp: new Date() };
      setChatMessages((prev) => [...prev, aiMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Resolve which minutes to show — edited version takes priority
  const activeMinutes = minutesData !== undefined ? minutesData : meeting.minutes;

  const handleAIEdit = async () => {
    if (!editRequest.trim() || !activeMinutes) return;
    setEditLoading(true);
    try {
      const res = await fetch("/api/edit-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: activeMinutes, request: editRequest }),
      });
      const data = await res.json();
      if (data.minutes) {
        setMinutesData(data.minutes);
        updateMinutes(meeting.id, data.minutes); // persist to Supabase
        setEditRequest("");
      }
    } catch {
      // silently fail — user sees no change
    } finally {
      setEditLoading(false);
    }
  };

  const handleExportDocx = async () => {
    const mins = activeMinutesRef.current;
    if (!mins) return;
    setExportingDocx(true);
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: mins, branding }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(mins.title || "minutes").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    const mins = activeMinutesRef.current;
    if (!mins) return;
    const activeMinutes = mins;
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pageW = 210;
      const margin = 18;
      const maxW = pageW - margin * 2;
      const HEADER_H = 22; // mm reserved at top for branded header
      const FOOTER_H = 10; // mm reserved at bottom for footer
      const CONTENT_TOP = margin + HEADER_H;
      const CONTENT_BOTTOM = 297 - margin - FOOTER_H;

      const accent = branding.accentColor || "#6366f1";
      const accentRgb = accent.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16)) as [number, number, number];
      const company = branding.companyName || "";
      const contactLine = [branding.website, branding.email, branding.phone].filter(Boolean).join("  ·  ");
      const footerNote = branding.footerNote || "Confidential – for internal use only";
      const preparedBy = branding.preparedBy || "MinuteFlow AI";

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = CONTENT_TOP;
      let pageNum = 1;

      // Draw branded header on current page
      const LOGO_W = 32; // mm — logo width
      const LOGO_H = 18; // mm — logo height (fills most of the header zone)
      const LOGO_GAP = 5; // mm between logo and text
      const drawHeader = () => {
        const hTop = margin - 2;
        // Accent bar at top
        doc.setFillColor(...accentRgb);
        doc.rect(margin, hTop, maxW, 1.2, "F");

        let textX = margin;

        if (branding.logoBase64) {
          try {
            const ext = branding.logoBase64.split(";")[0].split("/")[1]?.toUpperCase() as "PNG" | "JPEG" | "JPG";
            // Centre logo vertically in the header zone
            const logoY = hTop + (HEADER_H - LOGO_H) / 2;
            doc.addImage(branding.logoBase64, ext || "PNG", margin, logoY, LOGO_W, LOGO_H);
            textX = margin + LOGO_W + LOGO_GAP;
          } catch { /* skip broken logo */ }
        }

        if (company) {
          // Vertically centre the text block (company name + tagline) in header
          const textBlockH = branding.tagline ? 9 : 5;
          const textStartY = hTop + (HEADER_H - textBlockH) / 2 + 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(...accentRgb);
          doc.text(company, textX, textStartY);
          if (branding.tagline) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(branding.tagline, textX, textStartY + 5);
          }
        }

        // Thin rule below header
        doc.setDrawColor(...accentRgb);
        doc.setLineWidth(0.3);
        doc.line(margin, hTop + HEADER_H - 1, pageW - margin, hTop + HEADER_H - 1);
      };

      // Draw branded footer on current page
      const drawFooter = (total: number) => {
        const fTop = 297 - margin - FOOTER_H + 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, fTop, pageW - margin, fTop);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(footerNote, margin, fTop + 4);
        const right = contactLine || "";
        const pageLabel = `Page ${pageNum} of ${total}`;
        const combined = [right, pageLabel].filter(Boolean).join("   ·   ");
        doc.text(combined, pageW - margin, fTop + 4, { align: "right" });
      };

      // Add a new page with header
      const newPage = () => {
        doc.addPage();
        pageNum++;
        y = CONTENT_TOP;
        drawHeader();
      };

      // Write a text block, paginating as needed
      const addText = (text: string, size = 10, bold = false, color = "#0f172a", extraSpacing = 1.5) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const rgb = color.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16)) as [number, number, number];
        doc.setTextColor(...rgb);
        const lines = doc.splitTextToSize(text, maxW);
        const lineH = size * 0.37;
        for (const line of lines) {
          if (y + lineH > CONTENT_BOTTOM) {
            newPage();
            // drawHeader() changes font/color — restore them for the continued paragraph
            doc.setFontSize(size);
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.setTextColor(...rgb);
          }
          doc.text(line, margin, y);
          y += lineH + extraSpacing * 0.3;
        }
        y += 1;
      };

      const addSection = (title: string) => {
        if (y + 12 > CONTENT_BOTTOM) newPage();
        y += 3;
        doc.setDrawColor(...accentRgb);
        doc.setLineWidth(0.35);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
        addText(title, 12, true, accent, 2);
      };

      // Draw page 1 header
      drawHeader();
      y += 4; // extra gap so large title text doesn't overlap the header rule

      // Title block
      addText(activeMinutes.title || "Meeting Minutes", 17, true, "#0f172a", 3);
      addText(`${activeMinutes.date}  ·  ${activeMinutes.time}  ·  ${activeMinutes.duration}`, 9, false, "#64748b");
      addText(`Participants: ${(activeMinutes.participants ?? []).join(", ")}`, 9, false, "#475569");
      y += 3;

      const BODY = "#0f172a";
      const MUTED = "#475569";
      const LINE_H = 4.5; // mm per line at 10pt

      // Helper: render a pill-row (like bg-emerald-50 decision items)
      const addPillRow = (text: string, prefixSymbol: string, bgRgb: [number,number,number], prefixRgb: [number,number,number]) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const textX = margin + 8;
        const wrapped: string[] = doc.splitTextToSize(text, maxW - 10);
        const rH = wrapped.length * LINE_H + 4;
        if (y + rH > CONTENT_BOTTOM) {
          newPage();
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
        }
        doc.setFillColor(...bgRgb);
        doc.rect(margin, y - 3.5, maxW, rH, "F");
        doc.setTextColor(...prefixRgb);
        doc.text(prefixSymbol, margin + 2, y);
        doc.setTextColor(15, 23, 42);
        wrapped.forEach((line: string, i: number) => doc.text(line, textX, y + i * LINE_H));
        y += rH + 1.5;
      };

      // Helper: draw the action items table header
      const TABLE_COLS = [88, 40, 28, 18] as const;
      const TABLE_HEADS = ["Task", "Assignee", "Due Date", "Priority"];
      const TABLE_ROW_H = 7;
      const drawTableHeader = () => {
        if (y + TABLE_ROW_H > CONTENT_BOTTOM) newPage();
        doc.setFillColor(...accentRgb);
        doc.rect(margin, y - 5, maxW, TABLE_ROW_H, "F");
        let cx = margin + 2;
        TABLE_HEADS.forEach((h, i) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text(h, cx, y);
          cx += TABLE_COLS[i];
        });
        y += TABLE_ROW_H - 2;
      };

      if (activeMinutes.objectives?.length) {
        addSection("Objectives");
        activeMinutes.objectives.forEach((o) => addText(`›  ${o}`, 10, false, BODY));
      }
      if (activeMinutes.agenda?.length) {
        addSection("Agenda");
        activeMinutes.agenda.forEach((a) => addText(`›  ${a}`, 10, false, BODY));
      }

      addSection("Discussion Summary");
      addText(activeMinutes.discussionSummary || "", 10, false, BODY);

      if (activeMinutes.decisions?.length) {
        addSection("Decisions Made");
        activeMinutes.decisions.forEach((d) =>
          addPillRow(asText(d), "✓", [236, 253, 245], [16, 185, 129])
        );
      }

      if (activeMinutes.actionItems?.length) {
        addSection("Action Items");
        drawTableHeader();
        activeMinutes.actionItems.forEach((item, idx) => {
          const cells = [item.task, item.assignee || "—", item.dueDate || "—", item.priority || "—"];
          const wrappedTask: string[] = doc.splitTextToSize(cells[0], TABLE_COLS[0] - 4);
          const rH = Math.max(wrappedTask.length, 1) * LINE_H + 3;
          if (y + rH > CONTENT_BOTTOM) {
            newPage();
            drawTableHeader();
          }
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3.5, maxW, rH, "F");
          }
          let tx = margin + 2;
          cells.forEach((cell, ci) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            const lines: string[] = ci === 0 ? wrappedTask : [cell];
            lines.forEach((line: string, li: number) => doc.text(line, tx, y + li * LINE_H));
            tx += TABLE_COLS[ci];
          });
          y += rH + 1;
        });
        y += 2;
      }

      if (activeMinutes.risks?.length) {
        addSection("Risks & Considerations");
        activeMinutes.risks.forEach((r) =>
          addPillRow(asText(r), "!", [255, 251, 235], [217, 119, 6])
        );
      }
      if (activeMinutes.followUpItems?.length) {
        addSection("Follow-up Items");
        activeMinutes.followUpItems.forEach((f) => addText(`›  ${f}`, 10, false, BODY));
      }
      if (activeMinutes.nextMeeting) {
        addSection("Next Meeting");
        addText(asText(activeMinutes.nextMeeting), 10, false, BODY);
      }
      y += 4;
      addText(`Prepared by: ${preparedBy}`, 8, false, MUTED);

      // Stamp footers on all pages now that we know total page count
      const total = pageNum;
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        pageNum = p;
        drawFooter(total);
      }

      doc.save(`${(activeMinutes.title || "minutes").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "transcript", label: "Transcript", icon: <FileText size={13} /> },
    { key: "minutes", label: "Minutes", icon: <FileText size={13} /> },
    { key: "summary", label: "Summary", icon: <Sparkles size={13} /> },
    { key: "actions", label: "Action Items", icon: <CheckSquare size={13} /> },
    { key: "ai-chat", label: "AI Assistant", icon: <MessageSquare size={13} /> },
  ];

  const summaryTypes = [
    { key: "executive", label: "Executive" },
    { key: "bullet", label: "Bullet Points" },
    { key: "detailed", label: "Detailed" },
    { key: "oneSentence", label: "One Sentence" },
    { key: "clientFriendly", label: "Client-Friendly" },
    { key: "management", label: "Management" },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-slide-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/meetings"><Button variant="ghost" size="icon"><ArrowLeft size={16} /></Button></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-800 truncate">{meeting.title}</h2>
            <button onClick={() => toggleFavorite(meeting.id)}>
              <Star size={16} className={meeting.isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"} />
            </button>
            <Badge variant="success">Completed</Badge>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10} />{formatDate(meeting.date)}</span>
            <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(meeting.duration)}</span>
            <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={10} />{meeting.participants.join(", ")}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm"><Share2 size={13} /> Share</Button>
          <Button variant="outline" size="sm"><Download size={13} /> Export</Button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {meeting.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
        {meeting.team && <Badge variant="default">{meeting.team}</Badge>}
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <FileText size={14} className="text-indigo-500 shrink-0" />
          <span className="text-xs text-slate-500 truncate max-w-xs">{audioName}</span>
          <audio controls src={audioUrl} className="flex-1 h-8 min-w-0" style={{ colorScheme: "light" }} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeTab === key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Transcript Tab */}
      {activeTab === "transcript" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-1">
            {(meeting.transcript ?? []).map((seg) => {
              const speaker = getSpeaker(seg.speakerId);
              return (
                <div key={seg.id} className="group flex gap-4 p-3 rounded-xl hover:bg-white transition-colors">
                  <div className="shrink-0 pt-0.5">
                    <span className="text-xs font-mono text-slate-400">{formatTimestamp(seg.startTime)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: speaker?.color ?? "#94a3b8" }}>
                        {(speaker?.name ?? "?")[0]}
                      </div>
                      {editingSpeaker === seg.speakerId ? (
                        <div className="flex items-center gap-1">
                          <Input value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} className="h-6 text-xs w-32" />
                          <button onClick={() => { renameSpeaker(meeting.id, seg.speakerId, speakerName); setEditingSpeaker(null); }} className="text-emerald-500 hover:text-emerald-600"><Check size={12} /></button>
                          <button onClick={() => setEditingSpeaker(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingSpeaker(seg.speakerId); setSpeakerName(speaker?.name ?? ""); }}
                          className="text-xs font-semibold hover:text-indigo-600 transition-colors"
                          style={{ color: speaker?.color ?? "#94a3b8" }}
                        >
                          {speaker?.name ?? "Unknown"}
                        </button>
                      )}
                    </div>
                    {editingSegment === seg.id ? (
                      <div className="space-y-2">
                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className="text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { updateTranscriptSegment(meeting.id, seg.id, editText); setEditingSegment(null); }}>
                            <Check size={12} /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSegment(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingSegment(seg.id); setEditText(seg.text); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-slate-100"
                  >
                    <Edit2 size={12} className="text-slate-400" />
                  </button>
                </div>
              );
            })}
          </div>
          {/* Speakers sidebar */}
          <div>
            <Card className="sticky top-4">
              <CardHeader><span className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Users size={14} /> Speakers</span></CardHeader>
              <CardContent className="space-y-3">
                {(meeting.speakers ?? []).map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: s.color }}>
                      {s.name[0]}
                    </div>
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div className="max-w-4xl space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowEditPanel((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                showEditPanel
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300"
              )}
            >
              <Wand2 size={14} />
              Edit with AI
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportDocx}
                disabled={exportingDocx || !activeMinutes}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <FileDown size={14} />
                {exportingDocx ? "Exporting…" : "Word (.docx)"}
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf || !activeMinutes}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <FileTextIcon size={14} />
                {exportingPdf ? "Exporting…" : "PDF"}
              </button>
            </div>
          </div>

          {/* AI Edit Panel */}
          {showEditPanel && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm">
                <Wand2 size={14} />
                AI Minutes Editor
              </div>
              <p className="text-xs text-indigo-600">
                Describe what you&apos;d like to change — e.g. &quot;Add a risk about budget overrun&quot; or &quot;Change the next meeting date to July 10&quot;.
              </p>
              <div className="flex gap-2">
                <input
                  value={editRequest}
                  onChange={(e) => setEditRequest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAIEdit()}
                  placeholder="What would you like to change in these minutes?"
                  className="flex-1 text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={handleAIEdit}
                  disabled={editLoading || !editRequest.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {editLoading ? (
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : (
                    <>
                      <PenLine size={13} />
                      Apply
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeMinutes ? (
            /* ── Branded document preview ── */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Document Header */}
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center gap-4">
                  {branding.logoBase64 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding.logoBase64} alt="logo" className="h-12 w-auto object-contain shrink-0" />
                  )}
                  {(branding.companyName || branding.tagline) && (
                    <div>
                      {branding.companyName && (
                        <div className="text-lg font-bold" style={{ color: branding.accentColor }}>{branding.companyName}</div>
                      )}
                      {branding.tagline && (
                        <div className="text-xs text-slate-500">{branding.tagline}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-3 h-0.5 w-full" style={{ backgroundColor: branding.accentColor }} />
              </div>

              {/* Document Body */}
              <div className="px-8 pb-6 space-y-6">
                <div className="text-center border-b border-slate-100 pb-6">
                  <h1 className="text-2xl font-bold text-slate-900">{activeMinutes.title}</h1>
                  <div className="flex items-center justify-center gap-6 mt-3 text-sm text-slate-500">
                    <span>{activeMinutes.date}</span>
                    <span>·</span>
                    <span>{activeMinutes.time}</span>
                    <span>·</span>
                    <span>{activeMinutes.duration}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    <strong>Participants:</strong> {(activeMinutes.participants ?? []).join(", ")}
                  </div>
                </div>

                {[
                  { title: "Objectives", items: activeMinutes.objectives },
                  { title: "Agenda", items: activeMinutes.agenda },
                ].map(({ title, items }) => items?.length ? (
                  <div key={title}>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>{title}</h3>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: branding.accentColor }} />
                          {asText(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null)}

                <div>
                  <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Discussion Summary</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{activeMinutes.discussionSummary}</p>
                </div>

                {activeMinutes.decisions?.length ? (
                  <div>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Decisions Made</h3>
                    <ul className="space-y-2">
                      {activeMinutes.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700 bg-emerald-50 rounded-lg px-3 py-2">
                          <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          {asText(d)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeMinutes.actionItems?.length ? (
                  <div>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Action Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr style={{ backgroundColor: branding.accentColor }}>
                            {["Task", "Assignee", "Due Date", "Priority"].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-white font-semibold text-xs">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeMinutes.actionItems.map((item, i) => (
                            <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="px-3 py-2 text-slate-800">{item.task}</td>
                              <td className="px-3 py-2 text-slate-600">{item.assignee || "—"}</td>
                              <td className="px-3 py-2 text-slate-600">{item.dueDate || "—"}</td>
                              <td className="px-3 py-2 text-slate-600 capitalize">{item.priority || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeMinutes.risks?.length ? (
                  <div>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Risks &amp; Considerations</h3>
                    <ul className="space-y-1">
                      {activeMinutes.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-amber-500 mt-0.5">⚠</span>{asText(r)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeMinutes.followUpItems?.length ? (
                  <div>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Follow-up Items</h3>
                    <ul className="space-y-1">
                      {activeMinutes.followUpItems.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <ChevronRight size={14} className="text-slate-400 mt-0.5 shrink-0" />{asText(f)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeMinutes.nextMeeting && (
                  <div>
                    <h3 className="text-base font-semibold pb-1 mb-2 border-b" style={{ color: branding.accentColor, borderColor: branding.accentColor }}>Next Meeting</h3>
                    <p className="text-sm text-slate-700">{asText(activeMinutes.nextMeeting)}</p>
                  </div>
                )}
              </div>

              {/* Document Footer */}
              <div className="px-8 py-4 border-t border-slate-100">
                <div className="h-px w-full bg-slate-200 mb-3" />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{branding.footerNote || "Confidential – for internal use only"}</span>
                  <span className="flex gap-3">
                    {branding.website && <span>{branding.website}</span>}
                    {branding.email && <span>{branding.email}</span>}
                    {branding.phone && <span>{branding.phone}</span>}
                    {branding.preparedBy && <span>Prepared by: {branding.preparedBy}</span>}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-slate-400 text-sm">
                No meeting minutes available for this meeting.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === "summary" && meeting.summaries && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            {summaryTypes.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveSummaryType(key)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  activeSummaryType === key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-indigo-500" />
                    <span className="font-semibold text-slate-800">{summaryTypes.find((s) => s.key === activeSummaryType)?.label} Summary</span>
                  </div>
                  <Button variant="ghost" size="sm"><Copy size={13} /> Copy</Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{meeting.summaries[activeSummaryType as keyof typeof meeting.summaries]}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Action Items Tab */}
      {activeTab === "actions" && (
        <div className="max-w-4xl space-y-4">
          {(meeting.actionItems ?? []).map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={item.status === "completed"}
                  onChange={(e) => updateActionItem(meeting.id, item.id, { status: e.target.checked ? "completed" : "open" })}
                  className="mt-1 w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-slate-800", item.status === "completed" && "line-through text-slate-400")}>{item.task}</p>
                  {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{item.assignee}</Badge>
                    {item.dueDate && <Badge variant="warning" className="text-xs">Due {item.dueDate}</Badge>}
                    <Badge variant={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "default"} className="text-xs">{item.priority}</Badge>
                    <Badge variant={item.status === "completed" ? "success" : item.status === "in_progress" ? "info" : "outline"} className="text-xs">{item.status.replace("_", " ")}</Badge>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-slate-100"><MoreHorizontal size={14} className="text-slate-400" /></button>
              </div>
            </Card>
          ))}
          {(!meeting.actionItems || meeting.actionItems.length === 0) && (
            <div className="text-center py-12 text-slate-400 text-sm">No action items found</div>
          )}
        </div>
      )}

      {/* AI Chat Tab */}
      {activeTab === "ai-chat" && (
        <div className="max-w-3xl">
          <Card className="flex flex-col h-[600px]">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">AI Meeting Assistant</div>
                  <div className="text-xs text-slate-400">Ask anything about this meeting</div>
                </div>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={12} className="text-white" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-lg px-4 py-3 rounded-2xl text-sm",
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
                  )}>
                    <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Suggestions */}
            <div className="px-5 pb-3 flex gap-2 overflow-x-auto">
              {["What decisions were made?", "List all action items", "Tell me about the Hartmann account"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setChatInput(s); }}
                  className="shrink-0 text-xs bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this meeting…"
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!chatInput.trim() || chatLoading}>
                  {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
