"use client";

import { useEffect } from "react";
import { useMeetingsStore } from "@/store/meetings";

export default function StoreInitializer() {
  const fetchMeetings = useMeetingsStore((s) => s.fetchMeetings);
  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);
  return null;
}
