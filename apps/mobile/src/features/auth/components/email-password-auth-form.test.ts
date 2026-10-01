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

  it("exposes stable credential field labels for Android E2E automation", () => {
    const source = readFileSync(
      resolve(__dirname, "email-password-auth-form.tsx"),
      "utf8",
    );

    expect(source).toContain('"Sign-in" : "Sign-up"} email`');
    expect(source).toContain('"Sign-in" : "Sign-up"} password`');
  });

  it("opens the vault only after the second lock, with the real factor and no password in the route", () => {
    const source = readFileSync(
      resolve(__dirname, "email-password-auth-form.tsx"),
      "utf8",
    );

    expect(source).toContain("holdPendingSignIn(unlock);");
    expect(source).toContain("params: { factorId: nextResult.factorId, flow: \"returning\" },");
    expect(source).toContain('router.push({ pathname: "/auth/setup-totp", params: { flow: "sign-in" } });');
    expect(source).not.toContain('factorId: ""');
    expect(source).not.toMatch(/params: \{[^}]*password/u);
  });

  it("re-authenticates with the account's real factor and never without one", () => {
    const source = readFileSync(resolve(__dirname, "re-auth-panel.tsx"), "utf8");

    expect(source).toContain('totpService.verify(form.factorId ?? "", form.totpCode)');
    expect(source).toContain('nextResult.nextStep === "totp-enrollment"');
    expect(source).not.toContain("placeholder-factor-id");
  });

  it("enrols a real factor with a drawn QR code and no placeholder", () => {
    const source = readFileSync(resolve(__dirname, "totp-enrollment-panel.tsx"), "utf8");

    expect(source).toContain("createTotpEnrollmentService(createSupabaseClient())");
    expect(source).toContain("usePreventScreenCapture();");
    expect(source).toContain("<TotpQrCode otpauthUri={enrollment.otpauthUri} />");
    expect(source).not.toMatch(/placeholder|QrPlaceholder|console\./u);
  });
});
