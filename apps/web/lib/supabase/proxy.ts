import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getWebSupabaseConfig } from "./config";
import { createProtectedWebSecurityHeaders } from "./security-headers";

export async function updateWebSession(request: NextRequest) {
  const config = getWebSupabaseConfig();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const securityHeaders = createProtectedWebSecurityHeaders({
    nonce,
    secureRequest: request.nextUrl.protocol === "https:",
    supabaseUrl: config?.url,
  });
  const createResponse = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"]);
    requestHeaders.set("x-nonce", nonce);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };
  let response = createResponse();
  if (!config) return applySecurityHeaders(response, securityHeaders);

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = createResponse();
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getClaims();
  return applySecurityHeaders(response, securityHeaders);
}

function applySecurityHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
