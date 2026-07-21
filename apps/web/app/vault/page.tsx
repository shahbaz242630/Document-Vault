import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getWebSupabaseConfig } from "@/lib/supabase/config";
import { createWebServerClient } from "@/lib/supabase/server";
import { OwnerVault } from "./bank-account-vault";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Owner vault" };

export default async function VaultPage() {
  if (!getWebSupabaseConfig()) redirect("/login");

  const supabase = await createWebServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <section className="content-section">
        <header><p className="eyebrow">Protected owner vault</p><h1>Your encrypted vault</h1><p>This protected engineering workspace uses the same reviewed encrypted contracts as the mobile app for all 17 current vault categories.</p></header>
        <div className="callout"><strong>Zero-knowledge boundary retained</strong><p>Vault cryptography runs in a browser worker. Supabase stores ciphertext and safe metadata; the web server does not receive your readable record or encryption key.</p></div>
        <OwnerVault />
      </section>
    </main>
  );
}
