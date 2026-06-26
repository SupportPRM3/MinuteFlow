"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Square, Pause, Play, Clock, Volume2, CheckCircle, Loader } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDuration, cn } from "@/lib/utils";
import { useMeetingsStore } from "@/store/meetings";
import { Meeting } from "@/lib/types";
import Link from "next/link";

type RecordState = "idle" | "recording" | "paused" | "stopped" | "processing" | "done";

const PROCESSING_STAGES = [
  { label: "Uploading audio", duration: 2000 },
  { label: "Transcribing", duration: 3000 },
  { label: "Detecting speakers", duration: 2000 },
  { label: "Generating AI summary", duration: 2500 },
  { label: "Creating meeting minutes", duration: 2000 },
];

export default function RecordPage() {
  const { addMeeting } = useMeetingsStore();
  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(20).fill(3));
  const [stageIndex, setStageIndex] = useState(-1);
  const [stageProgress, setStageProgress] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      levelRef.current = setInterval(() => {
        setLevels(() => Array.from({ length: 20 }, () => 2 + Math.random() * 28));
      }, 150);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelRef.current) clearInterval(levelRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelRef.current) clearInterval(levelRef.current);
    };
  }, [state]);

  const startRecording = () => { setState("recording"); };
  const pauseRecording = () => setState("paused");
  const resumeRecording = () => setState("recording");

  const stopRecording = () => {
    setState("processing");
    setStageIndex(0);
    setStageProgress(0);
    runProcessing();
  };

  const runProcessing = async () => {
    for (let i = 0; i < PROCESSING_STAGES.length; i++) {
      setStageIndex(i);
      const dur = PROCESSING_STAGES[i].duration;
      const steps = 20;
      for (let j = 0; j <= steps; j++) {
        setStageProgress((j / steps) * 100);
        await new Promise((r) => setTimeout(r, dur / steps));
      }
    }
    const id = `rec-${Date.now()}`;
    const newMeeting: Meeting = {
      id,
      title: title || "Untitled Recording",
      date: new Date().toISOString(),
      duration: elapsed,
      participants: ["Jovit Aleria"],
      status: "completed",
      tags: ["recorded"],
      isFavorite: false,
      createdBy: "Jovit Aleria",
      summaries: {
        executive: "This meeting was recorded and transcribed by MinuteFlow AI.",
        bullet: "• Meeting recorded via MinuteFlow\n• AI processing completed",
        detailed: "Meeting recorded directly via the MinuteFlow browser recorder. Full AI processing completed.",
        oneSentence: "A meeting was recorded and processed by MinuteFlow AI.",
        clientFriendly: "Meeting successfully recorded and processed.",
        management: "Meeting recording completed and processed.",
      },
      actionItems: [],
      transcript: [],
      speakers: [],
    };
    addMeeting(newMeeting);
    setCreatedId(id);
    setState("done");
  };

  const overallProgress = stageIndex >= 0
    ? ((stageIndex / PROCESSING_STAGES.length) * 100 + stageProgress / PROCESSING_STAGES.length)
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Record Meeting</h2>
        <p className="text-sm text-slate-500 mt-0.5">Capture your meeting and let AI handle the rest</p>
      </div>

      {state === "done" ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Processing Complete</h3>
          <p className="text-sm text-slate-500 mb-6">Your meeting has been transcribed and AI-processed.</p>
          <div className="flex gap-3 justify-center">
            {createdId && (
              <Link href={`/meetings/${createdId}`}>
                <Button>View Meeting</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => { setState("idle"); setElapsed(0); setTitle(""); }}>
              Record Another
            </Button>
          </div>
        </Card>
      ) : state === "processing" ? (
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Loader size={28} className="text-indigo-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">AI Processing</h3>
            <p className="text-sm text-slate-500 mt-1">This usually takes a minute…</p>
          </div>
          <Progress value={overallProgress} className="mb-6" />
          <div className="space-y-3">
            {PROCESSING_STAGES.map((stage, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                  i < stageIndex ? "bg-emerald-500 text-white" :
                  i === stageIndex ? "bg-indigo-500 text-white" :
                  "bg-slate-100 text-slate-400"
                )}>
                  {i < stageIndex ? <CheckCircle size={12} /> : i + 1}
                </div>
                <span className={cn("text-sm", i <= stageIndex ? "text-slate-800 font-medium" : "text-slate-400")}>
                  {stage.label}
                </span>
                {i === stageIndex && (
                  <div className="flex-1"><Progress value={stageProgress} /></div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Title */}
          <Card className="p-5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Meeting Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Strategy Review, Client Call…"
              disabled={state !== "idle"}
            />
          </Card>

          {/* Recorder */}
          <Card className="p-8 text-center">
            {/* Timer */}
            <div className="text-4xl font-mono font-bold text-slate-800 mb-6 tabular-nums">
              {formatDuration(elapsed)}
              {state === "recording" && (
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-3 mb-1 animate-recording" />
              )}
            </div>

            {/* Waveform */}
            <div className="flex items-center justify-center gap-0.5 h-14 mb-8">
              {levels.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-100",
                    state === "recording" ? "bg-indigo-500" : state === "paused" ? "bg-amber-400" : "bg-slate-200"
                  )}
                  style={{ height: state === "recording" ? `${h}px` : "4px" }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {state === "idle" && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 transition-all hover:scale-105"
                >
                  <Mic size={24} />
                </button>
              )}
              {state === "recording" && (
                <>
                  <button onClick={pauseRecording} className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition-colors">
                    <Pause size={16} />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                </>
              )}
              {state === "paused" && (
                <>
                  <button onClick={resumeRecording} className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 flex items-center justify-center transition-colors">
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 text-xs text-slate-400">
              {state === "idle" && "Click the microphone to begin recording"}
              {state === "recording" && <span className="text-red-500 font-medium animate-recording">● Recording in progress</span>}
              {state === "paused" && <span className="text-amber-500 font-medium">⏸ Recording paused</span>}
            </div>
          </Card>

          {/* Info */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Volume2, label: "Microphone", value: "Built-in" },
              { icon: Clock, label: "Auto-save", value: "Every 30s" },
              { icon: Mic, label: "Format", value: "WAV 16kHz" },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label} className="p-4 text-center">
                <Icon size={16} className="text-slate-400 mx-auto mb-1" />
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">{value}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
