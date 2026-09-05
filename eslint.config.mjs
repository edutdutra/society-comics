import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project-specific:
    ".cache/**",
    "src/components/ui/**",
  ]),

  ...nextVitals,
  ...nextTs,

  // Type-aware rules for our own source. `projectService` picks up tsconfig.json
  // automatically, so new files are covered without touching this config.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  // Plugins e rotas do Fastify precisam ser `async` mesmo sem `await`: a
  // assinatura de plugin exige uma função que devolva Promise, e é ela que o
  // Fastify usa para saber quando o registro terminou. Não é await esquecido.
  {
    files: ["src/server/plugins/**/*.ts", "src/server/routes/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },

  // Must stay last: turns off every rule that would fight Prettier.
  eslintConfigPrettier,
]);

export default eslintConfig;
