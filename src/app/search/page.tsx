"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, FileText, Clock, Users, Calendar, Mic, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMeetingsStore } from "@/store/meetings";
import { formatDuration, formatRelative, cn } from "@/lib/utils";

const SUGGESTIONS = ["Q3 revenue", "Hartmann", "action items", "budget", "product roadmap", "Sarah Chen"];

export default function SearchPage() {
  const { meetings } = useMeetingsStore();
  const [query, setQuery] = useState("");

  const results = query.trim().length < 2 ? [] : meetings.filter((m) => {
    const q = query.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.participants.some((p) => p.toLowerCase().includes(q)) ||
      m.tags.some((t) => t.toLowerCase().includes(q)) ||
      m.transcript?.some((s) => s.text.toLowerCase().includes(q)) ||
      m.actionItems?.some((a) => a.task.toLowerCase().includes(q)) ||
      m.summaries?.executive.toLowerCase().includes(q)
    );
  });

  const getMatchContext = (m: typeof meetings[0]) => {
    const q = query.toLowerCase();
    const seg = m.transcript?.find((s) => s.text.toLowerCase().includes(q));
    if (seg) {
      const idx = seg.text.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      const end = Math.min(seg.text.length, idx + query.length + 40);
      return "…" + seg.text.slice(start, end) + "…";
    }
    const ai = m.actionItems?.find((a) => a.task.toLowerCase().includes(q));
    if (ai) return `Action Item: ${ai.task}`;
    return m.summaries?.executive?.slice(0, 120) + "…";
  };

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Search</h2>
        <p className="text-sm text-slate-500 mt-0.5">Search across meetings, transcripts, participants, and action items</p>
      </div>

      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meetings, transcripts, participants, action items…"
          className="w-full h-12 pl-11 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100">
            <X size={14} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Suggestions */}
      {!query && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Suggested searches</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setQuery(s)} className="text-sm bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {query.trim().length >= 2 && (
        <div>
          <p className="text-xs text-slate-400 mb-3">{results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;</p>
          {results.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No meetings found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((m) => (
                <Link key={m.id} href={m.status === "completed" ? `/meetings/${m.id}` : "#"}>
                  <Card className="p-4 hover:shadow-md transition-shadow group">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Mic size={15} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                            {highlight(m.title)}
                          </p>
                          <Badge variant="success" className="shrink-0">Completed</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed">
                          {highlight(getMatchContext(m) ?? "")}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10} />{formatRelative(m.date)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} />{formatDuration(m.duration)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={10} />{m.participants.slice(0, 2).join(", ")}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
