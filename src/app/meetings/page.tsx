"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Grid, List, Star, Mic, Clock, Users, Calendar, MoreHorizontal, Folder, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useMeetingsStore } from "@/store/meetings";
import { formatDuration, formatRelative, cn } from "@/lib/utils";

const statusColors: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  uploading: "warning", transcribing: "info", detecting_speakers: "info",
  generating_summary: "info", creating_minutes: "info", completed: "success", failed: "danger",
};
const statusLabels: Record<string, string> = {
  uploading: "Uploading", transcribing: "Transcribing", detecting_speakers: "Detecting Speakers",
  generating_summary: "Generating Summary", creating_minutes: "Creating Minutes",
  completed: "Completed", failed: "Failed",
};

export default function MeetingsLibrary() {
  const { meetings, folders, toggleFavorite, hydrated } = useMeetingsStore();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");

  const teams = Array.from(new Set(meetings.map((m) => m.team).filter(Boolean))) as string[];

  const filtered = meetings.filter((m) => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.participants.some((p) => p.toLowerCase().includes(search.toLowerCase())) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || m.status === filterStatus;
    const matchTeam = filterTeam === "all" || m.team === filterTeam;
    return matchSearch && matchStatus && matchTeam;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Meeting Library</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meetings.length} meetings · {meetings.filter((m) => m.status === "completed").length} completed</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload"><Button variant="outline"><Upload size={14} /> Upload</Button></Link>
          <Link href="/record"><Button><Mic size={14} /> Record</Button></Link>
        </div>
      </div>

      {/* Folders */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shrink-0">
          <Folder size={13} /> All Meetings
        </button>
        {folders.map((f) => (
          <button key={f.id} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:border-slate-300 transition-colors shrink-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
            {f.name}
            <span className="text-xs text-slate-400">{f.meetingCount}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings, participants, tags…" className="pl-9" />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40">
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="transcribing">Transcribing</option>
          <option value="uploading">Uploading</option>
          <option value="failed">Failed</option>
        </Select>
        <Select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="w-36">
          <option value="all">All Teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
          <button onClick={() => setView("list")} className={cn("px-3 py-2 transition-colors", view === "list" ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}>
            <List size={14} />
          </button>
          <button onClick={() => setView("grid")} className={cn("px-3 py-2 transition-colors", view === "grid" ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600")}>
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Meeting list */}
      {view === "list" ? (
        <Card className="overflow-hidden">
          {!hydrated ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading meetings…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Mic size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No meetings found</p>
            </div>
          ) : (
            filtered.map((m, i) => (
              <div key={m.id} className={cn("group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors", i !== 0 ? "border-t border-slate-100" : "")}>
                <button onClick={() => toggleFavorite(m.id)} className="shrink-0 text-slate-300 hover:text-amber-400 transition-colors">
                  <Star size={15} className={m.isFavorite ? "fill-amber-400 text-amber-400" : ""} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Mic size={16} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  {m.status === "completed" ? (
                    <Link href={`/meetings/${m.id}`} className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors block truncate">
                      {m.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.title}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10} />{formatRelative(m.date)}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(m.duration)}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={10} />{m.participants.slice(0, 2).join(", ")}{m.participants.length > 2 ? ` +${m.participants.length - 2}` : ""}</span>
                  </div>
                  {m.status !== "completed" && m.processingProgress !== undefined && (
                    <div className="mt-2 w-48"><Progress value={m.processingProgress} /></div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs hidden sm:inline-flex">{tag}</Badge>
                  ))}
                  <Badge variant={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100">
                    <MoreHorizontal size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Mic size={16} className="text-indigo-500" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFavorite(m.id)}>
                    <Star size={14} className={m.isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"} />
                  </button>
                  <Badge variant={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                </div>
              </div>
              {m.status === "completed" ? (
                <Link href={`/meetings/${m.id}`} className="font-semibold text-sm text-slate-800 hover:text-indigo-600 line-clamp-2 block mb-2">{m.title}</Link>
              ) : (
                <p className="font-semibold text-sm text-slate-800 line-clamp-2 mb-2">{m.title}</p>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400"><Calendar size={10} />{formatRelative(m.date)}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400"><Clock size={10} />{formatDuration(m.duration)}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400"><Users size={10} />{m.participants.slice(0, 2).join(", ")}</div>
              </div>
              {m.status !== "completed" && m.processingProgress !== undefined && (
                <div className="mt-3"><Progress value={m.processingProgress} /></div>
              )}
              <div className="flex flex-wrap gap-1 mt-3">
                {m.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
