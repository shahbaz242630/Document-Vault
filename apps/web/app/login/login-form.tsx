"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createWebBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    try {
      const { error: signInError } = await createWebBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Sign-in failed. Check your details and try again.");
        return;
      }
      router.replace("/vault");
      router.refresh();
    } catch {
      setError("Sign-in is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={!configured || pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {!configured ? <p role="status">Web sign-in is not enabled in this protected environment.</p> : null}
    </form>
  );
}
