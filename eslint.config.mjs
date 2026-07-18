import coreWebVitalsConfig from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

// Extract the react-hooks plugin from eslint-config-next's flat config so we
// can reference it without adding it as a direct dev dependency.
const reactHooksPlugin = coreWebVitalsConfig.find((c) => c.plugins?.["react-hooks"])?.plugins?.[
    "react-hooks"
];

const eslintConfig = [
    { ignores: [".trickfire-docs/"] },
    ...coreWebVitalsConfig,
    ...typescriptConfig,
    prettierConfig,
    ...(reactHooksPlugin
        ? [
              {
                  plugins: { "react-hooks": reactHooksPlugin },
                  rules: {
                      "react-hooks/set-state-in-effect": "off",
                      "react-hooks/incompatible-library": "off",
                  },
              },
          ]
        : []),
];

export default eslintConfig;
