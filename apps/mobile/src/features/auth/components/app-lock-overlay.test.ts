import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("AppLockOverlay biometric unlock routing", () => {
  it("routes to the vault after cached-key biometric unlock succeeds", () => {
    const source = readFileSync(resolve(__dirname, "app-lock-overlay.tsx"), "utf8");

    expect(source).toContain("const router = useRouter();");
    expect(source).toContain("createAppLockService");
    expect(source).toContain("supabaseClient.auth.getSession()");
    expect(source).toContain("Your sign-in session expired");
    expect(source).toContain('router.replace("/auth/sign-in");');
    expect(source).toContain("onUsePassword={handleUsePassword}");
    expect(source).toContain('router.replace("/vault");');
  });
});
