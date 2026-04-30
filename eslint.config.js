import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // ── Renderer guardrail (NANA-263) ─────────────────────────────────────────
  // Architectural mandate: the renderer must never import the Nango Node SDK
  // or hit api.nango.dev directly. All Nango calls go through the
  // environment-scoped IPC bridge (window.nango.*). This rule blocks both
  // accidental direct imports and ad-hoc fetches to the Nango API.
  {
    files: ["packages/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nangohq/node", "@nangohq/node/*"],
              message:
                "Renderer must not import @nangohq/node — use window.nango.* (IPC bridge) so calls are scoped to the active environment.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='fetch'] > Literal[value=/^https?:\\/\\/api\\.nango\\.dev/]",
          message:
            "Renderer must not call api.nango.dev directly — route the request through window.nango.* (IPC bridge).",
        },
        {
          selector:
            "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^https?:\\/\\/api\\.nango\\.dev/]",
          message:
            "Renderer must not call api.nango.dev directly — route the request through window.nango.* (IPC bridge).",
        },
      ],
    },
  },
  prettierConfig,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js"],
  },
];
