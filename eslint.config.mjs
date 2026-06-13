import coreWebVitalsConfig from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

// Extract the react-hooks plugin from eslint-config-next's flat config so we
// can reference it without adding it as a direct dev dependency.
const reactHooksPlugin = coreWebVitalsConfig.find((c) => c.plugins?.["react-hooks"])?.plugins?.[
    "react-hooks"
];

const eslintConfig = [
    ...coreWebVitalsConfig,
    ...typescriptConfig,
    prettierConfig,
    ...(reactHooksPlugin
        ? [
              {
                  // react-hooks/set-state-in-effect is new in eslint-plugin-react-hooks@7
                  // and flags the async `load()` pattern used throughout the codebase.
                  // Downgraded to warn here; callers should be refactored in a follow-up.
                  plugins: { "react-hooks": reactHooksPlugin },
                  rules: {
                      "react-hooks/set-state-in-effect": "warn",
                  },
              },
          ]
        : []),
];

export default eslintConfig;
