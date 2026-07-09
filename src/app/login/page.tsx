"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Mic size={18} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">MinuteFlow</span>
        </div>

        <Card className="p-6">
          <h1 className="text-lg font-bold text-slate-800 mb-1">Log in</h1>
          <p className="text-sm text-slate-500 mb-5">Welcome back — sign in to your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Password</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-indigo-600 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
