"use client";

import { UserPlus, Mail, Shield, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const members = [
  { name: "Jovit Aleria", email: "jaleria@prm3tax.com", role: "Owner", avatar: "JA", meetings: 12, color: "bg-indigo-500" },
  { name: "Mike Johnson", email: "mike@prm3tax.com", role: "Editor", avatar: "MJ", meetings: 8, color: "bg-emerald-500" },
  { name: "Sarah Chen", email: "sarah@prm3tax.com", role: "Editor", avatar: "SC", meetings: 6, color: "bg-amber-500" },
  { name: "David Park", email: "david@prm3tax.com", role: "Viewer", avatar: "DP", meetings: 4, color: "bg-purple-500" },
  { name: "Emily Torres", email: "emily@prm3tax.com", role: "Viewer", avatar: "ET", meetings: 3, color: "bg-red-400" },
];

const roleColors: Record<string, "default" | "success" | "warning" | "info"> = {
  Owner: "default", Editor: "success", Viewer: "info",
};

export default function TeamPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Team</h2>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} members</p>
        </div>
        <Button><UserPlus size={14} /> Invite Member</Button>
      </div>

      {/* Invite card */}
      <Card className="p-5 mb-6 bg-indigo-50 border-indigo-100">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2"><Mail size={14} /> Invite Team Members</h3>
        <div className="flex gap-2">
          <Input placeholder="Enter email address…" className="flex-1 bg-white" />
          <select className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none">
            <option>Editor</option>
            <option>Viewer</option>
          </select>
          <Button size="md">Send Invite</Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Shield size={14} className="text-slate-400" /> Members & Permissions
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {members.map((m, i) => (
            <div key={m.email} className={`flex items-center gap-4 px-5 py-3.5 ${i !== 0 ? "border-t border-slate-100" : ""}`}>
              <div className={`w-9 h-9 rounded-full ${m.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{m.meetings} meetings</span>
                <Badge variant={roleColors[m.role]}>{m.role}</Badge>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <MoreHorizontal size={14} className="text-slate-400" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
