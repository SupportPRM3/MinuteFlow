import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => void;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: () => {
    if (initialized) return;
    initialized = true;

    supabase.auth.getUser().then(({ data }) => {
      set({ user: data.user, loading: false });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false });
    });
  },
}));
