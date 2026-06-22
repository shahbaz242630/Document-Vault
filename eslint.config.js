const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: [
            "apps/mobile/tsconfig.json",
            "packages/*/tsconfig.json",
            "services/*/tsconfig.json",
          ],
        },
      },
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
  },
  globalIgnores(["**/.expo/**", "coverage/**", "dist/**"]),
]);
