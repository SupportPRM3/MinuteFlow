"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Square, Pause, Play, Clock, Volume2, CheckCircle, Loader } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatDuration, currentMeetingDate, cn } from "@/lib/utils";
import { useMeetingsStore } from "@/store/meetings";
import { useAuthStore } from "@/store/auth";
import { Meeting } from "@/lib/types";
import { uploadRecordingForProcessing } from "@/lib/audio-storage";
import { runTranscription } from "@/lib/transcribe-client";
import Link from "next/link";

type RecordState = "idle" | "recording" | "paused" | "processing" | "done";

// Mirrors the stages emitted by the SSE API (same as the Upload page)
const STAGE_LABELS: Record<string, string> = {
  compressing:  "Compressing audio",
  transcribing: "Transcribing with Whisper AI",
  analyzing:    "Analyzing with Claude AI",
  finalizing:   "Creating meeting minutes",
};
const STAGE_ORDER = ["compressing", "transcribing", "analyzing", "finalizing"];

const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export default function RecordPage() {
  const { addMeeting, updateMeetingStatus } = useMeetingsStore();
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(20).fill(3));
  const [currentStage, setCurrentStage] = useState<string>("");
  const [stageMessage, setStageMessage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether a checkpoint (upload / transcript) was already saved for the in-flight
  // meeting, so a failure can tell the user what's recoverable instead of a dead-end error.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [transcriptSaved, setTranscriptSaved] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      levelTimerRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        if (!analyser) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setLevels(Array.from(data.slice(0, 20), (v) => 2 + (v / 255) * 30));
      }, 150);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    };
  }, [state]);

  // Release the microphone if the user navigates away mid-recording
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = RECORDER_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      recorder.start();
      setElapsed(0);
      setState("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings and try again.");
    }
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setState("paused");
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setState("recording");
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setState("processing");
    setCurrentStage("compressing");
    setStageMessage("Uploading recording…");
    setProgress(5);

    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await audioContextRef.current?.close().catch(() => {});
    await stopped;

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
    await processRecording(blob);
  };

  const processRecording = async (blob: Blob) => {
    if (!user) return;
    const id = `rec-${Date.now()}`;
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
    const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "Unknown";

    setError(null);
    setSavedId(null);
    setTranscriptSaved(false);
    // Plain locals (not state) — state set earlier in this same async call isn't
    // visible to reads later in the call until after a render, so the catch block
    // below can't rely on the `savedId`/`transcriptSaved` state for its decision.
    let uploadSaved = false;
    let transcriptSavedLocal = false;
    const baseMeeting: Meeting = {
      id,
      title: title || "Untitled Recording",
      date: currentMeetingDate(),
      duration: elapsed,
      participants: [displayName],
      status: "transcribing",
      tags: ["recorded"],
      isFavorite: false,
      createdBy: displayName,
      transcript: [],
      actionItems: [],
    };

    try {
      const fileUrl = await uploadRecordingForProcessing(id, file, user.id);

      // Checkpoint 1: the recording itself is uploaded and safe in storage — save a
      // stub record now so nothing is lost if transcription or analysis fails next.
      addMeeting(baseMeeting);
      uploadSaved = true;
      setSavedId(id);

      setProgress(15);
      setStageMessage("Starting AI processing…");

      const finalData = await runTranscription(
        fileUrl,
        file.name,
        (stage, message, pct) => {
          setCurrentStage(stage);
          setStageMessage(message);
          setProgress(pct);
        },
        (transcript) => {
          // Checkpoint 2: transcription finished — save it immediately so it survives
          // even if the AI analysis step below fails.
          const segments = transcript as unknown as Meeting["transcript"];
          const duration = segments && segments.length ? segments[segments.length - 1].endTime : elapsed;
          addMeeting({ ...baseMeeting, status: "generating_summary", transcript: segments, duration });
          transcriptSavedLocal = true;
          setTranscriptSaved(true);
        }
      );
      setProgress(100);

      const newMeeting: Meeting = {
        ...baseMeeting,
        title: title || (finalData.title as string) || "Untitled Recording",
        duration: Array.isArray(finalData.transcript) && finalData.transcript.length
          ? (finalData.transcript[finalData.transcript.length - 1] as { endTime: number }).endTime
          : elapsed,
        participants: (finalData.participants as string[]) ?? [displayName],
        status: "completed",
        transcript: finalData.transcript as Meeting["transcript"],
        speakers: finalData.speakers as Meeting["speakers"],
        summaries: finalData.summaries as Meeting["summaries"],
        actionItems: (finalData.actionItems as Meeting["actionItems"]) ?? [],
        minutes: finalData.minutes as Meeting["minutes"],
      };

      // Checkpoint 3: full analysis done — final save.
      addMeeting(newMeeting);
      setCreatedId(id);
      setState("done");
    } catch (err) {
      if (uploadSaved || transcriptSavedLocal) {
        // Something was already checkpointed (recording and/or transcript) — mark the
        // saved record as failed rather than leaving it stuck on "transcribing" forever.
        updateMeetingStatus(id, "failed");
      }
      setError(err instanceof Error ? err.message : "Processing failed. Please try again.");
      setState("idle");
      setCurrentStage("");
      setProgress(0);
    }
  };

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
            <Button variant="outline" onClick={() => { setState("idle"); setElapsed(0); setTitle(""); setCreatedId(null); }}>
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
            <h3 className="text-lg font-bold text-slate-800">Processing recording</h3>
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
                  disabled={!user}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 transition-all hover:scale-105 disabled:opacity-50"
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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <p>{error}</p>
              {savedId && (
                <p className="mt-1.5 text-red-500">
                  {transcriptSaved
                    ? "Good news: the transcript was already saved before this failed. "
                    : "Good news: the recording was already saved before this failed. "}
                  <Link href={`/meetings/${savedId}`} className="underline font-medium hover:text-red-700">
                    View it{transcriptSaved ? " and retry AI analysis" : ""}
                  </Link>
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Volume2, label: "Microphone", value: "Browser mic" },
              { icon: Clock, label: "Live level", value: "Real-time" },
              { icon: Mic, label: "Format", value: "WebM/Opus" },
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
