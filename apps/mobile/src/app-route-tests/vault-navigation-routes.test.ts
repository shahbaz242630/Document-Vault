import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("vault navigation routes", () => {
  it("keeps dashboard, add, and records as separate destinations", () => {
    const dashboardRoute = readFileSync(
      resolve(process.cwd(), "app/vault/index.tsx"),
      "utf8",
    );
    const addRoute = readFileSync(
      resolve(process.cwd(), "app/vault/add.tsx"),
      "utf8",
    );
    const recordsRoute = readFileSync(
      resolve(process.cwd(), "app/vault/records.tsx"),
      "utf8",
    );

    expect(dashboardRoute).toContain("VaultDashboard");
    expect(addRoute).toContain("VaultAddMenu");
    expect(recordsRoute).toContain("VaultRecordsMenu");
  });

  it("keeps top-level vault navigation outside scrolling content", () => {
    const dashboardRoute = readFileSync(
      resolve(process.cwd(), "app/vault/index.tsx"),
      "utf8",
    );
    const addRoute = readFileSync(
      resolve(process.cwd(), "app/vault/add.tsx"),
      "utf8",
    );
    const recordsRoute = readFileSync(
      resolve(process.cwd(), "app/vault/records.tsx"),
      "utf8",
    );
    const screen = readFileSync(
      resolve(process.cwd(), "src/shared/ui/screen.tsx"),
      "utf8",
    );

    const normalizedDashboardRoute = dashboardRoute.replaceAll("\r\n", "\n");
    const normalizedAddRoute = addRoute.replaceAll("\r\n", "\n");
    const normalizedRecordsRoute = recordsRoute.replaceAll("\r\n", "\n");

    expect(normalizedDashboardRoute).toContain(
      'fixedBottom={\n        isReady ? <VaultBottomNavigation active="home" />',
    );
    expect(normalizedAddRoute).toContain(
      'fixedBottom={\n        isReady ? <VaultBottomNavigation active="add" />',
    );
    expect(normalizedRecordsRoute).toContain(
      'fixedBottom={\n        isReady ? <VaultBottomNavigation active="records" />',
    );
    expect(screen.indexOf("</ScrollView>")).toBeLessThan(
      screen.indexOf("{fixedBottom ?"),
    );
  });

  it("gives both top-level vault pages an explicit route back to dashboard", () => {
    const addMenu = readFileSync(
      resolve(
        process.cwd(),
        "src/features/vault/components/vault-add-menu.tsx",
      ),
      "utf8",
    );
    const recordsMenu = readFileSync(
      resolve(
        process.cwd(),
        "src/features/vault/components/vault-records-menu.tsx",
      ),
      "utf8",
    );

    expect(addMenu).toContain('router.replace("/vault")');
    expect(recordsMenu).toContain('router.replace("/vault")');
    expect(addMenu).toContain('eyebrow="Dashboard"');
    expect(recordsMenu).toContain('eyebrow="Dashboard"');
  });
});
