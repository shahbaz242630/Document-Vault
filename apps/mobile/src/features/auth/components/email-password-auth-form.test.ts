import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("EmailPasswordAuthForm session handoff", () => {
  it("reuses the signed-in Supabase client for returning-user vault unlock", () => {
    const source = readFileSync(
      resolve(__dirname, "email-password-auth-form.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "const supabaseClient = useMemo(() => createSupabaseClient(), []);",
    );
    expect(source).toContain("createAuthService(supabaseClient)");
    expect(source).toContain(
      "supabaseClient as unknown as SupabaseKeyMaterialClient",
    );
    expect(source).toContain(
      "supabaseClient as unknown as SupabaseVaultClient",
    );
    expect(source).not.toContain(
      "const client = createSupabaseClient();",
    );
  });
});
