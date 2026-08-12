const staticConfig = require("./app.json").expo;

const PROBE_TARGET = "claimant_custody_probe";
const APP_ATTEST_PROBE_TARGET = "claimant_app_attest_probe";

module.exports = ({ config = staticConfig } = {}) => {
  const base = config;
  const isProbe = process.env.SANDUQKIN_BUILD_TARGET === PROBE_TARGET;
  const isAppAttestProbe = process.env.SANDUQKIN_BUILD_TARGET === APP_ATTEST_PROBE_TARGET;
  const isIsolatedProbe = isProbe || isAppAttestProbe;
  const plugins = base.plugins.map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== "expo-router") return plugin;
    return ["expo-router", {
      root: isProbe ? "./probe-app" : isAppAttestProbe ? "./app-attest-probe-app" : "./app",
    }];
  });

  return {
    ...base,
    name: isProbe ? "Sanduqkin Custody Probe" : isAppAttestProbe ? "Sanduqkin App Attest Probe" : base.name,
    slug: base.slug,
    scheme: isProbe
      ? "sanduqkin-claimant-custody-probe"
      : isAppAttestProbe ? "sanduqkin-claimant-app-attest-probe" : base.scheme,
    ios: {
      ...base.ios,
      bundleIdentifier: isProbe
        ? "com.sanduqkin.mobile.claimantprobe"
        : isAppAttestProbe ? "com.sanduqkin.mobile.claimantappattestprobe" : base.ios.bundleIdentifier,
      deploymentTarget: isAppAttestProbe ? "27.0" : base.ios.deploymentTarget,
      entitlements: isAppAttestProbe
        ? { "com.apple.developer.devicecheck.appattest-environment": "development" }
        : undefined,
      infoPlist: {
        ...base.ios.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins,
    extra: {
      ...base.extra,
      claimantCustodyProbeBuild: isProbe,
      claimantAppAttestProbeBuild: isAppAttestProbe,
      claimantIsolatedProbeBuild: isIsolatedProbe,
    },
  };
};

module.exports.PROBE_TARGET = PROBE_TARGET;
module.exports.APP_ATTEST_PROBE_TARGET = APP_ATTEST_PROBE_TARGET;
