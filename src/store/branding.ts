"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BrandingSettings {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  accentColor: string;   // hex e.g. "#6366f1"
  logoBase64: string;    // data:image/... base64 string, or ""
  footerNote: string;    // e.g. "Confidential – for internal use only"
  preparedBy: string;    // override "Prepared by" line
}

interface BrandingState {
  branding: BrandingSettings;
  setBranding: (updates: Partial<BrandingSettings>) => void;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  companyName: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  accentColor: "#6366f1",
  logoBase64: "",
  footerNote: "Confidential – for internal use only",
  preparedBy: "MinuteFlow AI",
};

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      branding: DEFAULT_BRANDING,
      setBranding: (updates) =>
        set((state) => ({ branding: { ...state.branding, ...updates } })),
    }),
    { name: "minuteflow-branding" }
  )
);
