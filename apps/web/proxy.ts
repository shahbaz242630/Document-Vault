import type { NextRequest } from "next/server";

import { updateWebSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateWebSession(request);
}

export const config = {
  matcher: ["/login", "/vault/:path*"],
};
