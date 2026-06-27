"use client";

import { useState, useRef } from "react";
import { User, Bell, Shield, Trash2, Save, Check, Palette, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBrandingStore } from "@/store/branding";

type Section = "profile" | "branding" | "notifications" | "security" | "data";

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [saved, setSaved] = useState(false);
  const { branding, setBranding } = useBrandingStore();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState({
    uploadComplete: true,
    transcriptionDone: true,
    summaryReady: true,
    minutesGenerated: true,
    zoomImport: false,
    exportComplete: true,
  });

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBranding({ logoBase64: reader.result as string });
    reader.readAsDataURL(file);
  };

  const nav = [
    { key: "profile" as Section, icon: User, label: "Profile" },
    { key: "branding" as Section, icon: Palette, label: "Branding" },
    { key: "notifications" as Section, icon: Bell, label: "Notifications" },
    { key: "security" as Section, icon: Shield, label: "Security & Privacy" },
    { key: "data" as Section, icon: Trash2, label: "Data & Storage" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences</p>
      </div>
      <div className="flex gap-6">
        <aside className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {nav.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  section === key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon size={15} />{label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-5">
          {section === "profile" && (
            <>
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">Personal Information</span></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                    <div className="w-14 h-14 rounded-full bg-indigo-500 flex items-center justify-center text-xl font-bold text-white">JA</div>
                    <div>
                      <Button variant="outline" size="sm">Change Photo</Button>
                      <p className="text-xs text-slate-400 mt-1">JPG or PNG, max 2MB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">First Name</label>
                      <Input defaultValue="Jovit" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Last Name</label>
                      <Input defaultValue="Aleria" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                    <Input defaultValue="jaleria@prm3tax.com" type="email" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Organization</label>
                    <Input defaultValue="PRM3 Tax" />
                  </div>
                  <Button onClick={save}>
                    {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Changes</>}
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">AI Preferences</span></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Default Summary Type</label>
                    <select className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option>Executive Summary</option>
                      <option>Bullet Points</option>
                      <option>Detailed Summary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Prepared By (in minutes)</label>
                    <Input defaultValue="MinuteFlow AI Assistant" />
                  </div>
                  <Button onClick={save} variant="outline">
                    {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {section === "branding" && (
            <>
              {/* Live preview */}
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">Document Preview</span></CardHeader>
                <CardContent>
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    {/* Header preview */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b-4" style={{ borderColor: branding.accentColor }}>
                      {branding.logoBase64 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.logoBase64} alt="logo" className="h-8 w-auto object-contain" />
                      ) : (
                        <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: branding.accentColor }}>
                          {(branding.companyName || "B")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800" style={{ color: branding.accentColor }}>{branding.companyName || "Your Company Name"}</p>
                        {branding.tagline && <p className="text-slate-500 text-[10px]">{branding.tagline}</p>}
                      </div>
                    </div>
                    {/* Simulated content */}
                    <div className="px-5 py-3 space-y-1 bg-white">
                      <div className="h-2.5 bg-slate-200 rounded w-2/3" />
                      <div className="h-2 bg-slate-100 rounded w-full" />
                      <div className="h-2 bg-slate-100 rounded w-5/6" />
                    </div>
                    {/* Footer preview */}
                    <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400">
                      <span>{branding.footerNote || "Confidential – for internal use only"}</span>
                      <span>{branding.website || branding.email || "your@company.com"} · Page 1</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Logo */}
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">Logo</span></CardHeader>
                <CardContent className="space-y-3">
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
                  {branding.logoBase64 ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={branding.logoBase64} alt="logo" className="h-14 w-auto object-contain border border-slate-200 rounded-lg p-2 bg-white" />
                      <div className="space-y-1">
                        <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}><Upload size={13} /> Replace</Button>
                        <button onClick={() => setBranding({ logoBase64: "" })} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-1"><X size={11} /> Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => logoInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                      <Upload size={20} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-500 font-medium">Upload logo</p>
                      <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG · Recommended 200×60px</p>
                    </button>
                  )}
                </CardContent>
              </Card>

              {/* Company details */}
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">Company Details</span></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Company Name</label>
                      <Input value={branding.companyName} onChange={(e) => setBranding({ companyName: e.target.value })} placeholder="Prolific Tax and Multiservice" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Tagline / Subtitle</label>
                      <Input value={branding.tagline} onChange={(e) => setBranding({ tagline: e.target.value })} placeholder="Professional Tax & Payroll Services" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                      <Input value={branding.phone} onChange={(e) => setBranding({ phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                      <Input value={branding.email} onChange={(e) => setBranding({ email: e.target.value })} placeholder="info@company.com" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Website</label>
                      <Input value={branding.website} onChange={(e) => setBranding({ website: e.target.value })} placeholder="www.company.com" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Address</label>
                      <Input value={branding.address} onChange={(e) => setBranding({ address: e.target.value })} placeholder="123 Main St, City, ST 00000" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Footer Note</label>
                      <Input value={branding.footerNote} onChange={(e) => setBranding({ footerNote: e.target.value })} placeholder="Confidential – for internal use only" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Prepared By</label>
                      <Input value={branding.preparedBy} onChange={(e) => setBranding({ preparedBy: e.target.value })} placeholder="MinuteFlow AI" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Accent color */}
              <Card>
                <CardHeader><span className="text-sm font-semibold text-slate-800">Accent Color</span></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500">Used for header bar, section titles, and highlights in exported documents.</p>

                  {/* Preset swatches */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#0f172a","#64748b","#0d9488","#b45309","#be123c"].map((c) => (
                      <button
                        key={c}
                        title={c}
                        onClick={() => setBranding({ accentColor: c })}
                        className={cn("w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shrink-0",
                          branding.accentColor === c ? "border-slate-700 scale-110 ring-2 ring-offset-1 ring-slate-400" : "border-white shadow-sm")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  {/* Hex input row */}
                  <div className="flex items-center gap-3">
                    {/* Color preview swatch */}
                    <div
                      className="w-10 h-10 rounded-xl border border-slate-200 shadow-sm shrink-0"
                      style={{ backgroundColor: branding.accentColor }}
                    />
                    {/* Editable hex field */}
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400">
                      <span className="text-slate-400 text-sm font-mono select-none">#</span>
                      <input
                        type="text"
                        value={branding.accentColor.replace("#", "")}
                        maxLength={6}
                        spellCheck={false}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
                          setBranding({ accentColor: val.length === 6 ? `#${val}` : branding.accentColor });
                          // Keep input showing what the user is typing even mid-edit
                          e.target.value = val;
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.replace(/[^0-9a-fA-F]/g, "");
                          if (val.length === 6) setBranding({ accentColor: `#${val}` });
                          else e.target.value = branding.accentColor.replace("#", "");
                        }}
                        className="w-24 bg-transparent text-sm font-mono text-slate-800 focus:outline-none uppercase tracking-widest"
                        placeholder="6366F1"
                      />
                    </div>
                    <p className="text-xs text-slate-400">Type any hex color code, e.g. <span className="font-mono">003087</span></p>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={save}>
                {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Branding</>}
              </Button>
            </>
          )}

          {section === "notifications" && (
            <Card>
              <CardHeader><span className="text-sm font-semibold text-slate-800">Notification Preferences</span></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    uploadComplete: "Upload Complete",
                    transcriptionDone: "Transcription Finished",
                    summaryReady: "AI Summary Ready",
                    minutesGenerated: "Meeting Minutes Generated",
                    zoomImport: "Zoom Recording Imported",
                    exportComplete: "Export Completed",
                  };
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{labels[key]}</p>
                        <p className="text-xs text-slate-400">Receive a notification when this event occurs</p>
                      </div>
                      <button
                        onClick={() => setNotifications((n) => ({ ...n, [key]: !value }))}
                        className={cn("relative w-10 h-5 rounded-full transition-colors", value ? "bg-indigo-600" : "bg-slate-200")}
                      >
                        <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-5" : "translate-x-0.5")} />
                      </button>
                    </div>
                  );
                })}
                <Button onClick={save}>
                  {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Preferences</>}
                </Button>
              </CardContent>
            </Card>
          )}

          {section === "security" && (
            <Card>
              <CardHeader><span className="text-sm font-semibold text-slate-800">Security & Privacy</span></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                    <Shield size={14} /> All recordings are encrypted at rest and in transit
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Change Password</label>
                  <Input type="password" placeholder="Current password" className="mb-2" />
                  <Input type="password" placeholder="New password" className="mb-2" />
                  <Input type="password" placeholder="Confirm new password" />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-400">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" size="sm">Enable</Button>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Audit Logs</p>
                    <p className="text-xs text-slate-400">View recent account activity</p>
                  </div>
                  <Button variant="outline" size="sm">View Logs</Button>
                </div>
                <Button onClick={save}>
                  {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Update Password</>}
                </Button>
              </CardContent>
            </Card>
          )}

          {section === "data" && (
            <Card>
              <CardHeader><span className="text-sm font-semibold text-slate-800">Data & Storage</span></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Storage used</span>
                    <span className="font-medium text-slate-800">2.4 GB / 10 GB</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: "24%" }} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Data Retention</p>
                    <p className="text-xs text-slate-400">Auto-delete meetings older than</p>
                  </div>
                  <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>Never</option>
                    <option>1 year</option>
                    <option>2 years</option>
                    <option>6 months</option>
                  </select>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="text-slate-600 mr-2">Export All Data</Button>
                  <Button variant="danger" size="sm">Delete All Recordings</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
