import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { getWebSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Sign in" };

export default function LoginPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <section className="content-section">
        <header><p className="eyebrow">Owner vault proof</p><h1>Sign in to Sanduqkin</h1><p>The newest successful login becomes the active account session. Web vault access remains a protected engineering preview.</p></header>
        <LoginForm configured={getWebSupabaseConfig() !== null} />
      </section>
    </main>
  );
}
