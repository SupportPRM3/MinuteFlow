"use client";

import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/meetings": "Meeting Library",
  "/record": "Record Meeting",
  "/upload": "Upload Recording",
  "/search": "Search",
  "/team": "Team",
  "/integrations": "Integrations",
  "/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const isMeeting = pathname.startsWith("/meetings/");
  const title = isMeeting ? "Meeting Details" : (pageTitles[pathname] ?? "MinuteFlow");

  return (
    <header className="h-14 border-b border-slate-100 bg-white flex items-center px-6 gap-4 shrink-0">
      <h1 className="font-semibold text-slate-800 text-sm">{title}</h1>
      <div className="flex-1" />
      <div className="relative hidden md:block w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <Input placeholder="Search meetings…" className="pl-9 h-8 text-xs" />
      </div>
      <Button variant="ghost" size="icon" className="relative">
        <Bell size={16} className="text-slate-500" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
      </Button>
    </header>
  );
}
