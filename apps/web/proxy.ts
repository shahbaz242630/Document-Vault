import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getClaimantWebRuntimeConfig,
  isClaimantWebRequestAllowed,
  isProtectedClaimantPath,
} from "@/lib/claimant/runtime-config";
import { updateWebSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (isProtectedClaimantPath(request.nextUrl.pathname)) {
    const allowed = isClaimantWebRequestAllowed(
      request.nextUrl.pathname,
      request.nextUrl.hostname,
      getClaimantWebRuntimeConfig(),
    );
    if (!allowed) {
      return new NextResponse(null, {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
        status: 404,
      });
    }
  }
  return updateWebSession(request);
}

export const config = {
  matcher: ["/login", "/vault/:path*", "/claimant/:path*"],
};
