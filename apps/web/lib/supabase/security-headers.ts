type ProtectedWebSecurityHeaderOptions = {
  nonce: string;
  secureRequest: boolean;
  supabaseUrl?: string;
};

export function createProtectedWebSecurityHeaders({
  nonce,
  secureRequest,
  supabaseUrl,
}: ProtectedWebSecurityHeaderOptions) {
  const connectSources = ["'self'", ...createSupabaseConnectSources(supabaseUrl)].join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    ...(secureRequest ? ["upgrade-insecure-requests"] : []),
  ];
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": `${directives.join("; ")};`,
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  if (secureRequest) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

function createSupabaseConnectSources(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return [];
  const url = new URL(supabaseUrl);
  const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${websocketProtocol}//${url.host}`];
}
