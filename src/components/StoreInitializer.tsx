"use client";

import { useEffect } from "react";
import { useMeetingsStore } from "@/store/meetings";
import { useAuthStore } from "@/store/auth";

export default function StoreInitializer() {
  const fetchMeetings = useMeetingsStore((s) => s.fetchMeetings);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (authLoading) return;
    fetchMeetings();
  }, [authLoading, user?.id, fetchMeetings]);

  return null;
}
