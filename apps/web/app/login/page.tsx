import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";
import { getWebSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Sign in" };

export default function LoginPage() {
  return (
    <main id="main-content" className="auth-page" tabIndex={-1}>
      <section className="auth-layout" aria-labelledby="sign-in-title">
        <div className="auth-intro">
          <p className="eyebrow">Owner vault</p>
          <h1 id="sign-in-title">Welcome back.</h1>
          <p className="auth-intro-copy">
            Sign in to securely access your encrypted Sanduqkin vault from this protected preview.
          </p>
        </div>

        <div className="auth-assurances" aria-label="Security assurances">
          <div>
            <span aria-hidden="true">01</span>
            <p><strong>Private by design</strong>Your vault details decrypt only in your active client.</p>
          </div>
          <div>
            <span aria-hidden="true">02</span>
            <p><strong>One active login</strong>The newest successful sign-in becomes your active account session.</p>
          </div>
        </div>

        <div className="auth-card">
          <header className="auth-card-header">
            <span className="auth-status"><span aria-hidden="true" /> Protected preview</span>
            <h2>Sign in to your vault</h2>
            <p>Use the email address and password connected to your Sanduqkin account.</p>
          </header>

          <LoginForm configured={getWebSupabaseConfig() !== null} />

          <div className="auth-card-footer">
            <p>Your password is sent directly to the authentication provider and is not handled by a Sanduqkin server action.</p>
            <Link href="/">Return to the Sanduqkin homepage <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
