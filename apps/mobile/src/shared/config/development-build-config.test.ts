import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../..");

describe("development build configuration", () => {
  it("defines an Android development-client build profile", () => {
    const easPath = resolve(repoRoot, "eas.json");

    expect(existsSync(easPath)).toBe(true);

    const easConfig = JSON.parse(readFileSync(easPath, "utf8")) as {
      build?: {
        development?: {
          android?: {
            buildType?: string;
          };
          developmentClient?: boolean;
          distribution?: string;
        };
      };
    };

    expect(easConfig.build?.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
      android: {
        buildType: "apk",
      },
    });
  });

  it("installs expo-dev-client and exposes a dev-client Metro script", () => {
    const packagePath = resolve(repoRoot, "apps/mobile/package.json");
    const packageConfig = JSON.parse(readFileSync(packagePath, "utf8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageConfig.dependencies).toHaveProperty("expo-dev-client");
    expect(packageConfig.scripts?.["start:dev-client"]).toBe(
      "expo start --dev-client",
    );
  });

  it("declares a stable Android application id for local dev builds", () => {
    const appConfigPath = resolve(repoRoot, "apps/mobile/app.json");
    const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8")) as {
      expo?: {
        android?: {
          package?: string;
        };
      };
    };

    expect(appConfig.expo?.android?.package).toBe("com.sanduqkin.mobile");
  });

  it("declares a stable iOS bundle id for Apple dev builds", () => {
    const appConfigPath = resolve(repoRoot, "apps/mobile/app.json");
    const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8")) as {
      expo?: {
        ios?: {
          bundleIdentifier?: string;
        };
      };
    };

    expect(appConfig.expo?.ios?.bundleIdentifier).toBe("com.sanduqkin.mobile");
  });

  it("registers the native libsodium Expo config plugin", () => {
    const appConfigPath = resolve(repoRoot, "apps/mobile/app.json");
    const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8")) as {
      expo?: {
        plugins?: (string | [string, Record<string, unknown>])[];
      };
    };

    expect(appConfig.expo?.plugins).toContainEqual([
      "react-native-libsodium",
      {},
    ]);
  });

  it("installs native libsodium for both Android and iOS crypto", () => {
    const packagePath = resolve(repoRoot, "apps/mobile/package.json");
    const packageConfig = JSON.parse(readFileSync(packagePath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(packageConfig.dependencies).toHaveProperty(
      "react-native-libsodium",
    );
  });

  it("documents the vetted native libsodium React Native Directory exception", () => {
    const packagePath = resolve(repoRoot, "apps/mobile/package.json");
    const packageConfig = JSON.parse(readFileSync(packagePath, "utf8")) as {
      expo?: {
        doctor?: {
          reactNativeDirectoryCheck?: {
            exclude?: string[];
          };
        };
      };
    };

    expect(
      packageConfig.expo?.doctor?.reactNativeDirectoryCheck?.exclude,
    ).toContain("react-native-libsodium");
  });
});
