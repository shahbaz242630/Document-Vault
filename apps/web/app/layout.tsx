import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sanduqkin",
    template: "%s | Sanduqkin",
  },
  description:
    "A private foundation for organizing the information that matters to you and the people you trust.",
  icons: {
    icon: "/favicon.svg",
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
          <header className="site-header">
            <Link className="wordmark" href="/" aria-label="Sanduqkin home">
              Sanduqkin
            </Link>
            <span className="preview-label">Private preview</span>
          </header>
          {children}
          <footer className="site-footer">
            <p>Encrypted on your device. Controlled by you.</p>
            <a href="/health.json">Service status</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
