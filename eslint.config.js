const { defineConfig, globalIgnores } = require("eslint/config");
const nextPlugin = require("@next/eslint-plugin-next");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: [
            "apps/mobile/tsconfig.json",
            "apps/web/tsconfig.json",
            "packages/*/tsconfig.json",
            "services/*/tsconfig.json",
          ],
        },
      },
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
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
  globalIgnores([
    "**/.expo/**",
    "**/.next/**",
    "apps/web/next-env.d.ts",
    "coverage/**",
    "dist/**",
  ]),
]);
