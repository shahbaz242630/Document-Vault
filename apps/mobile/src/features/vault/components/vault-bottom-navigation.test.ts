import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("VaultBottomNavigation", () => {
  it("maps every tab to its authenticated destination", () => {
    const source = readFileSync(
      resolve(__dirname, "vault-bottom-navigation.tsx"),
      "utf8",
    );

    expect(source).toContain('href: "/vault"');
    expect(source).toContain('href: "/vault/add"');
    expect(source).toContain('href: "/vault/records"');
    expect(source).toContain('href: "/settings"');
    expect(source).toContain("router.replace(item.href)");
  });

  it("does not replace the current route when its active tab is pressed", () => {
    const source = readFileSync(
      resolve(__dirname, "vault-bottom-navigation.tsx"),
      "utf8",
    );

    expect(source).toContain("else if (!isActive && item.href)");
  });

  it("offers a dedicated lock action with native icons", () => {
    const source = readFileSync(
      resolve(__dirname, "vault-bottom-navigation.tsx"),
      "utf8",
    );

    expect(source).toContain('icon: "lock-closed-outline"');
    expect(source).toContain('id: "lock"');
    expect(source).toContain("lock();");
    expect(source).toContain("<Ionicons");
  });
});
