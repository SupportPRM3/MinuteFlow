"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileAudio, FileVideo, CheckCircle, Loader, X, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, cn } from "@/lib/utils";
import { useMeetingsStore } from "@/store/meetings";
import { Meeting } from "@/lib/types";
import { saveRecording } from "@/lib/audio-storage";
import Link from "next/link";

const ACCEPTED = ".mp3,.wav,.m4a,.aac,.mp4,.mov,.mpeg";
const AUDIO_EXTS = ["mp3", "wav", "m4a", "aac", "mpeg"];

// Mirrors the stages emitted by the SSE API
const STAGE_LABELS: Record<string, string> = {
  compressing:  "Compressing audio",
  transcribing: "Transcribing with Whisper AI",
  analyzing:    "Analyzing with Claude AI",
  finalizing:   "Creating meeting minutes",
};
const STAGE_ORDER = ["compressing", "transcribing", "analyzing", "finalizing"];

export default function UploadPage() {
  const { addMeeting } = useMeetingsStore();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>("");
  const [stageMessage, setStageMessage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const processFile = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setProgress(5);
    setCurrentStage("compressing");
    setStageMessage("Uploading recording…");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
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
            setCurrentStage(payload.stage);
            setStageMessage(payload.message);
            setProgress(payload.pct);
          } else if (eventLine === "done") {
            setProgress(100);
            finalData = payload;
          } else if (eventLine === "error") {
            throw new Error(payload.message);
          }
        }
      }

      if (!finalData) throw new Error("Processing failed — no data received.");

      const id = `upload-${Date.now()}`;
      const newMeeting: Meeting = {
        id,
        title: title || (finalData.title as string) || file.name,
        date: new Date().toISOString(),
        duration: Array.isArray(finalData.transcript) && finalData.transcript.length
          ? (finalData.transcript[finalData.transcript.length - 1] as { endTime: number }).endTime
          : 3600,
        participants: (finalData.participants as string[]) ?? ["Speaker 1"],
        status: "completed",
        tags: ["uploaded"],
        isFavorite: false,
        createdBy: "Jovit Aleria",
        transcript: finalData.transcript as Meeting["transcript"],
        speakers: finalData.speakers as Meeting["speakers"],
        summaries: finalData.summaries as Meeting["summaries"],
        actionItems: (finalData.actionItems as Meeting["actionItems"]) ?? [],
        minutes: finalData.minutes as Meeting["minutes"],
      };

      addMeeting(newMeeting);
      await saveRecording(id, file).catch(() => {});
      setCreatedId(id);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed. Please try again.");
      setProcessing(false);
      setCurrentStage("");
      setProgress(0);
    }
  };

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const isAudio = ext && AUDIO_EXTS.includes(ext);

  if (done) return (
    <div className="p-6 max-w-2xl mx-auto animate-slide-in">
      <Card className="p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Processing Complete!</h3>
        <p className="text-sm text-slate-500 mb-6">Transcript, AI summaries, and meeting minutes are ready.</p>
        <div className="flex gap-3 justify-center">
          {createdId && <Link href={`/meetings/${createdId}`}><Button>View Meeting <ArrowRight size={14} /></Button></Link>}
          <Button variant="outline" onClick={() => { setFile(null); setTitle(""); setDone(false); setCurrentStage(""); setProgress(0); }}>Upload Another</Button>
        </div>
      </Card>
    </div>
  );

  if (processing) return (
    <div className="p-6 max-w-2xl mx-auto animate-slide-in">
      <Card className="p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Loader size={28} className="text-indigo-500 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Processing {file?.name}</h3>
          <p className="text-sm text-slate-500 mt-1">{stageMessage || "Preparing…"}</p>
        </div>
        <div className="mb-6">
          <Progress value={progress} />
          <p className="text-xs text-slate-400 text-right mt-1">{progress}%</p>
        </div>
        <div className="space-y-3">
          {STAGE_ORDER.map((stage, i) => {
            const currentIdx = STAGE_ORDER.indexOf(currentStage);
            const isDone = i < currentIdx;
            const isActive = stage === currentStage;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors",
                  isDone   ? "bg-emerald-500 text-white" :
                  isActive ? "bg-indigo-500 text-white" :
                             "bg-slate-100 text-slate-400"
                )}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span className={cn("text-sm transition-colors", (isDone || isActive) ? "text-slate-800 font-medium" : "text-slate-400")}>
                  {STAGE_LABELS[stage]}
                </span>
                {isActive && (
                  <span className="flex gap-0.5 ml-1">
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Upload Recording</h2>
        <p className="text-sm text-slate-500 mt-0.5">Upload an audio or video file — AI will transcribe and generate minutes automatically</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer mb-5",
          dragging ? "border-indigo-400 bg-indigo-50" :
          file ? "border-emerald-300 bg-emerald-50 cursor-default" :
          "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              {isAudio ? <FileAudio size={22} className="text-emerald-600" /> : <FileVideo size={22} className="text-emerald-600" />}
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatFileSize(file.size)} · {ext?.toUpperCase()}</p>
              <Badge variant="success" className="mt-1.5">Ready to process</Badge>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(""); }} className="ml-4 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Upload size={24} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">Drop your recording here</p>
            <p className="text-sm text-slate-400">or click to browse</p>
            <p className="text-xs text-slate-300 mt-3">MP3, WAV, M4A, AAC, MP4, MOV, MPEG</p>
          </>
        )}
      </div>

      {file && (
        <Card className="p-5 mb-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Meeting Title (optional)</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this meeting a name…" />
        </Card>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {["MP3", "WAV", "M4A", "AAC", "MP4", "MOV", "MPEG"].map((f) => (
          <span key={f} className="text-xs bg-white border border-slate-200 text-slate-500 px-2.5 py-1 rounded-full font-medium">{f}</span>
        ))}
      </div>

      <Button size="lg" disabled={!file} onClick={processFile} className="w-full">
        <Upload size={16} /> Process Recording with AI
      </Button>
    </div>
  );
}
