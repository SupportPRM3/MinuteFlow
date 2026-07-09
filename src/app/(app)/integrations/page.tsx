"use client";

import { useState } from "react";
import { Zap, Check, ExternalLink, Video, Calendar, Mail, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const integrations = [
  {
    id: "zoom",
    name: "Zoom",
    description: "Automatically import recordings after your Zoom meetings end. Transcribe and generate minutes instantly.",
    icon: "🎥",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
    category: "Video Conferencing",
    features: ["Auto-import recordings", "Real-time processing", "Meeting metadata sync"],
    status: "available",
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Connect your Google account to import Meet recordings from Google Drive automatically.",
    icon: "📹",
    color: "bg-emerald-50",
    iconColor: "text-emerald-600",
    category: "Video Conferencing",
    features: ["Drive integration", "Auto-import", "Calendar sync"],
    status: "available",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Import Teams meeting recordings from SharePoint and OneDrive automatically.",
    icon: "💼",
    color: "bg-indigo-50",
    iconColor: "text-indigo-600",
    category: "Video Conferencing",
    features: ["SharePoint sync", "Auto-import", "Outlook calendar"],
    status: "available",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Attach generated meeting notes to your Google Calendar events automatically.",
    icon: "📅",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
    category: "Calendar",
    features: ["Auto-attach notes", "Event sync", "Participant list"],
    status: "connected",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "Sync meeting notes with Outlook calendar events and send summaries via email.",
    icon: "📬",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
    category: "Calendar",
    features: ["Calendar sync", "Email summaries", "Event notes"],
    status: "available",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send meeting summaries and action items to Slack channels automatically after processing.",
    icon: "💬",
    color: "bg-purple-50",
    iconColor: "text-purple-600",
    category: "Communication",
    features: ["Channel notifications", "Action item alerts", "Summary sharing"],
    status: "available",
  },
];

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<string[]>(["google-calendar"]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const connect = async (id: string) => {
    setConnecting(id);
    await new Promise((r) => setTimeout(r, 1500));
    setConnected((prev) => [...prev, id]);
    setConnecting(null);
  };

  const disconnect = (id: string) => {
    setConnected((prev) => prev.filter((c) => c !== id));
  };

  const categories = Array.from(new Set(integrations.map((i) => i.category)));

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Integrations</h2>
        <p className="text-sm text-slate-500 mt-0.5">Connect your tools to automate your meeting workflow</p>
      </div>

      {/* Connected summary */}
      <Card className="p-5 mb-6 bg-indigo-50 border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900">{connected.length} integration{connected.length !== 1 ? "s" : ""} connected</p>
            <p className="text-xs text-indigo-600">Your workflow is automated across {connected.length} tool{connected.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </Card>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.filter((i) => i.category === category).map((integration) => {
              const isConnected = connected.includes(integration.id);
              const isConnecting = connecting === integration.id;
              return (
                <Card key={integration.id} className={cn("p-5 transition-shadow hover:shadow-md", isConnected && "ring-1 ring-emerald-200")}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl", integration.color)}>
                      {integration.icon}
                    </div>
                    {isConnected && <Badge variant="success"><Check size={10} /> Connected</Badge>}
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm mb-1">{integration.name}</h4>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">{integration.description}</p>
                  <div className="space-y-1 mb-4">
                    {integration.features.map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        {f}
                      </div>
                    ))}
                  </div>
                  {isConnected ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs">
                        <ExternalLink size={11} /> Configure
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => disconnect(integration.id)}>
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => connect(integration.id)} disabled={isConnecting}>
                      {isConnecting ? <><RefreshCw size={12} className="animate-spin" /> Connecting…</> : `Connect ${integration.name}`}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
