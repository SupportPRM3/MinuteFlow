"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export default function AuthInitializer() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return null;
}
