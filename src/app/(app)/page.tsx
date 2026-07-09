"use client";

import Link from "next/link";
import {
  Mic, Upload, Clock, Users, TrendingUp, Zap,
  FileText, CheckSquare, ArrowRight, Play, Calendar,
  BarChart2, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMeetingsStore } from "@/store/meetings";
import { useAuthStore } from "@/store/auth";
import { formatRelative, formatDuration } from "@/lib/utils";

export default function Dashboard() {
  const { meetings } = useMeetingsStore();
  const user = useAuthStore((s) => s.user);
  const firstName = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "").split(" ")[0];
  const completed = meetings.filter((m) => m.status === "completed");
  const processing = meetings.filter((m) => m.status !== "completed" && m.status !== "failed");
  const totalSeconds = completed.reduce((acc, m) => acc + m.duration, 0);
  const avgDuration = completed.length ? Math.round(totalSeconds / completed.length) : 0;
  const allActionItems = completed.flatMap((m) => m.actionItems ?? []);
  const openItems = allActionItems.filter((a) => a.status === "open");

  const statusColors: Record<string, string> = {
    uploading: "warning",
    transcribing: "info",
    detecting_speakers: "info",
    generating_summary: "info",
    creating_minutes: "info",
    completed: "success",
    failed: "danger",
  };

  const statusLabels: Record<string, string> = {
    uploading: "Uploading",
    transcribing: "Transcribing",
    detecting_speakers: "Detecting Speakers",
    generating_summary: "Generating Summary",
    creating_minutes: "Creating Minutes",
    completed: "Completed",
    failed: "Failed",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-slide-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Good morning{firstName ? `, ${firstName}` : ""}</h2>
          <p className="text-sm text-slate-500 mt-0.5">Here&apos;s your meeting overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" size="md">
              <Upload size={15} /> Upload Recording
            </Button>
          </Link>
          <Link href="/record">
            <Button size="md">
              <Mic size={15} /> Start Recording
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Meetings", value: meetings.length, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Hours Transcribed", value: `${(totalSeconds / 3600).toFixed(1)}h`, icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Avg Duration", value: formatDuration(avgDuration), icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Open Action Items", value: openItems.length, icon: CheckSquare, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Meetings */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-slate-400" />
                  <span className="font-semibold text-slate-800 text-sm">Recent Meetings</span>
                </div>
                <Link href="/meetings">
                  <Button variant="ghost" size="sm" className="text-xs text-indigo-600">
                    View all <ArrowRight size={12} />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {meetings.slice(0, 5).map((meeting, i) => (
                <Link key={meeting.id} href={meeting.status === "completed" ? `/meetings/${meeting.id}` : "#"}>
                  <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors ${i !== 0 ? "border-t border-slate-50" : ""}`}>
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Mic size={15} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{meeting.title}</p>
                        <Badge variant={statusColors[meeting.status] as "success" | "warning" | "info" | "danger" | "default"}>
                          {statusLabels[meeting.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={10} /> {formatRelative(meeting.date)}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10} /> {formatDuration(meeting.duration)}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Users size={10} /> {meeting.participants.length}
                        </span>
                      </div>
                    </div>
                    {meeting.status !== "completed" && meeting.processingProgress !== undefined && (
                      <div className="w-20 shrink-0">
                        <Progress value={meeting.processingProgress} />
                        <p className="text-xs text-slate-400 mt-1 text-right">{meeting.processingProgress}%</p>
                      </div>
                    )}
                    {meeting.status === "completed" && (
                      <ArrowRight size={14} className="text-slate-300 shrink-0" />
                    )}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Processing Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-amber-500" />
                <span className="font-semibold text-slate-800 text-sm">AI Processing</span>
                {processing.length > 0 && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {processing.length} active
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {processing.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-slate-400">
                  No items processing
                </div>
              ) : (
                processing.map((m) => (
                  <div key={m.id} className="px-5 py-3 border-t border-slate-50 first:border-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{m.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={m.processingProgress ?? 20} />
                      <span className="text-xs text-slate-400 shrink-0">{m.processingProgress ?? 20}%</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{statusLabels[m.status]}…</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-slate-400" />
                <span className="font-semibold text-slate-800 text-sm">Quick Actions</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/record">
                <Button variant="outline" size="md" className="w-full justify-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                    <Mic size={12} className="text-red-500" />
                  </div>
                  Record New Meeting
                </Button>
              </Link>
              <Link href="/upload">
                <Button variant="outline" size="md" className="w-full justify-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
                    <Upload size={12} className="text-indigo-500" />
                  </div>
                  Upload Audio File
                </Button>
              </Link>
              <Link href="/integrations">
                <Button variant="outline" size="md" className="w-full justify-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                    <Zap size={12} className="text-blue-500" />
                  </div>
                  Connect Zoom
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Open Action Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare size={15} className="text-slate-400" />
                  <span className="font-semibold text-slate-800 text-sm">Open Action Items</span>
                </div>
                <Badge variant="warning">{openItems.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {openItems.slice(0, 4).map((item) => (
                <div key={item.id} className="px-5 py-3 border-t border-slate-50 first:border-0">
                  <p className="text-xs font-medium text-slate-700 line-clamp-2">{item.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "default"} className="text-xs">
                      {item.priority}
                    </Badge>
                    <span className="text-xs text-slate-400">{item.assignee}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
