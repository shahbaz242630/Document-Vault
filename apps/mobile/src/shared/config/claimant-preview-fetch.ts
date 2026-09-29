import { isClaimantPreviewBuild } from "./claimant-preview-build";

/*
 * Staging wiring W2a: Vercel keeps preview deployments behind its login, including a preview custom domain, and
 * the Hobby plan cannot exempt one. The Sanduqkin Preview app therefore sends a dedicated Vercel automation bypass
 * with its claimant API requests. The value comes only from the Preview build's EAS environment; the real app has
 * no value and is never a Preview build, so it sends nothing. The value is never logged or shown.
 */
const BYPASS_HEADER = "x-vercel-protection-bypass";

type Send = (url: string, init?: RequestInit) => Promise<Response>;

export function withClaimantPreviewBypass<T extends Send>(send: T, input: Readonly<{
  preview?: boolean;
  // Literal read so Expo inlines the public build-time value.
  bypass?: string | undefined;
}> = { bypass: process.env.EXPO_PUBLIC_CLAIMANT_PREVIEW_API_BYPASS }): T {
  const bypass = input.bypass?.trim();
  if (!(input.preview ?? isClaimantPreviewBuild()) || !bypass || !/^[A-Za-z0-9_-]{16,128}$/u.test(bypass)) return send;
  return (async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set(BYPASS_HEADER, bypass);
    return send(url, { ...init, headers });
  }) as T;
}
