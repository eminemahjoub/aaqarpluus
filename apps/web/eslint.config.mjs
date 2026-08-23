import nextConfig from "eslint-config-next";

/**
 * Flat config (ESLint 9 + Next 16). eslint-config-next 16 ships flat config
 * arrays natively — no FlatCompat needed.
 *
 * Rule policy: keep real-bug rules (no-unused-vars as error, no-explicit-any
 * as warning) active everywhere EXCEPT the legacy dashboard monoliths, which
 * predate the lint gate and carry hundreds of pre-existing violations.
 * Suppression is scoped to those files (documented technical debt — to be
 * cleared during the monolith extraction work), not applied globally.
 */
const LEGACY_DASHBOARD_MONOLITHS = [
  "src/app/dashboard/properties/units/page.tsx",
  "src/app/dashboard/reports/page.tsx",
  "src/app/dashboard/tasks/page.tsx",
  "src/app/dashboard/agencies/page.tsx",
  "src/app/dashboard/contact/page.tsx",
  "src/app/dashboard/documents/page.tsx",
  "src/app/dashboard/maintenance/page.tsx",
  "src/components/dashboard/OwnerHomeDashboard.tsx",
  "src/components/dashboard/OwnerSidebar.tsx",
  "src/lib/receipt-template.ts",
];

// Legacy components that synchronously initialize state in effects
// (hydration / derived-state patterns) — pre-existing, exempted with debt.
const LEGACY_STATE_IN_EFFECT = [
  "src/app/admin/settings/page.tsx",
  "src/app/agency/messages/page.tsx",
  "src/app/dashboard/messages/page.tsx",
  "src/components/admin/AdminSidebar.tsx",
  "src/components/agency/UnitCard.tsx",
  "src/components/landing/ThemeToggle.tsx",
  "src/components/providers/theme-provider.tsx",
  "src/components/messages/ConversationList.tsx",
  "src/hooks/useMessagePolling.ts",
];

export default [
  ...nextConfig,
  {
    name: "app/rules",
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // style-only / framework noise
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    name: "app/legacy-dashboard-exemptions",
    files: [...LEGACY_DASHBOARD_MONOLITHS, ...LEGACY_STATE_IN_EFFECT],
    rules: {
      // pre-existing violations; exempted until extraction clears the debt
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    name: "app/ignores",
    ignores: [
      "scripts/**",
      "public/**",
      "next.config.ts",
      "next-env.d.ts",
      "vitest.config.ts",
      "eslint.config.mjs",
      "*.mjs",
    ],
  },
];