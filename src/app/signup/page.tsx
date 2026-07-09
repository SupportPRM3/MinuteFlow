"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, MailCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, Supabase returns no session yet.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="p-8 max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <MailCheck size={24} className="text-indigo-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Check your email</h1>
          <p className="text-sm text-slate-500">We sent a confirmation link to {email}. Click it to activate your account, then log in.</p>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-lg font-bold text-slate-800 mb-1">Create an account</h1>
          <p className="text-sm text-slate-500 mb-5">Start turning your meetings into minutes.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Full name</label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
