/**
 * Conventional Commits, validados no hook `commit-msg`.
 *
 * Convenção documentada em docs/CONVENTIONS.md.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["api", "importer", "ui", "db", "docs", "deps", "config", "release"],
    ],
    // O corpo do commit pode citar URLs e trechos de log, que não cabem em 100
    // colunas e não ganham nada em serem quebrados.
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
  },
};
