import nextConfig from "eslint-config-next";

// React Compiler rules are set to "error" in eslint-config-next but these
// are optimization hints, not runtime bugs. Downgrade to warn until the
// codebase is updated for full React Compiler compatibility.
const reactCompilerRules = {
  "react-hooks/static-components": "warn",
  "react-hooks/use-memo": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/globals": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/error-boundaries": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/set-state-in-render": "warn",
  "react-hooks/config": "warn",
  "react-hooks/gating": "warn",
};

export default [
  ...nextConfig,
  { rules: reactCompilerRules },
];
