export type ClaimantWebRuntimeConfig = Readonly<{
  allowedHosts: readonly string[];
  authenticationEnabled: boolean;
  environment: "development" | "test" | "production";
}>;

export function getClaimantWebRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): ClaimantWebRuntimeConfig {
  const environment = parseEnvironment(env.NODE_ENV);
  const authenticationEnabled = parseBoolean(env.CLAIMANT_WEB_AUTHENTICATION_ENABLED);
  const allowedHosts = Object.freeze(
    (env.CLAIMANT_WEB_ALLOWED_HOSTS ?? "")
      .split(",")
      .map(normalizeHost)
      .filter(Boolean),
  );

  if (environment === "production" && authenticationEnabled) {
    throw new Error("Claimant web authentication is not approved for production.");
  }
  if (authenticationEnabled && allowedHosts.length === 0) {
    throw new Error("Enabled claimant web authentication requires an exact host allowlist.");
  }

  return Object.freeze({ allowedHosts, authenticationEnabled, environment });
}

export function isProtectedClaimantPath(pathname: string): boolean {
  return pathname === "/claimant" || pathname.startsWith("/claimant/");
}

export function isClaimantWebRequestAllowed(
  pathname: string,
  hostname: string,
  config: ClaimantWebRuntimeConfig,
): boolean {
  if (!isProtectedClaimantPath(pathname) || !config.authenticationEnabled) return false;
  return config.allowedHosts.includes(normalizeHost(hostname));
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}

function parseEnvironment(value: string | undefined) {
  const normalized = value?.trim() || "development";
  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }
  throw new Error("NODE_ENV must be development, test, or production.");
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  throw new Error("CLAIMANT_WEB_AUTHENTICATION_ENABLED must be true or false.");
}
