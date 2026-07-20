import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteName, siteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sanduqkin — Private records, thoughtfully protected",
    template: `%s | ${siteName}`,
  },
  description:
    "Organize important records in an encrypted mobile vault and prepare for thoughtful, controlled continuity.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName,
    title: "Sanduqkin — Private records, thoughtfully protected",
    description: "An encrypted mobile vault for the records that matter.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Sanduqkin — Private records, thoughtfully protected",
    description: "An encrypted mobile vault for the records that matter.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="site-frame">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
