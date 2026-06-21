const { getDefaultConfig } = require("expo/metro-config");

/**
 * Metro configuration for the Vault mobile app.
 *
 * Optimizations:
 * - inlineRequires: defers requiring modules until they're used, reducing
 *   TTI (time-to-interactive) for the initial bundle.
 *
 * Monorepo watch folders are automatically inferred by expo/metro-config
 * from the workspace layout, so we do not override them.
 */
const config = getDefaultConfig(__dirname);

// Enable inline requires for faster startup.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
