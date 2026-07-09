"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, Mic, Upload, Settings, Search,
  Zap, BookOpen, Users, Bell, ChevronDown, Star, Folder, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingsStore } from "@/store/meetings";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/meetings", icon: BookOpen, label: "Meeting Library" },
  { href: "/record", icon: Mic, label: "Record Meeting" },
  { href: "/upload", icon: Upload, label: "Upload Recording" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { folders, meetings } = useMeetingsStore();
  const user = useAuthStore((s) => s.user);
  const favorites = meetings.filter((m) => m.isFavorite);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "Loading…";
  const displayEmail = user?.email ?? "";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-800 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg">
          <Mic size={16} className="text-white" />
        </div>
        <div>
          <span className="font-bold text-white text-sm tracking-wide">MinuteFlow</span>
          <div className="text-slate-500 text-xs">AI Meeting Assistant</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Main nav */}
        <div className="space-y-0.5 mb-6">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 mb-2">
              <Star size={12} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Favorites</span>
            </div>
            {favorites.slice(0, 3).map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors truncate"
              >
                <Star size={10} className="text-amber-400 shrink-0 fill-amber-400" />
                <span className="truncate">{m.title}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Folders */}
        <div>
          <div className="flex items-center gap-2 px-3 mb-2">
            <Folder size={12} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Folders</span>
          </div>
          {folders.map((f) => (
            <Link key={f.id} href={`/meetings?folder=${f.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-slate-600 text-xs">{f.meetingCount}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* User */}
      <div className="relative px-3 py-4 border-t border-slate-800">
        {menuOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <LogOut size={12} /> Log out
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initialsFor(displayName)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium text-white truncate">{displayName}</div>
            <div className="text-xs text-slate-500 truncate">{displayEmail}</div>
          </div>
          <ChevronDown size={12} className="text-slate-500 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
