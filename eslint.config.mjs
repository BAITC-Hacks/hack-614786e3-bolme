import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // three.js / react-three-fiber code mutates scene objects (camera, controls,
    // fog, uniforms) inside useFrame by design; the React Compiler immutability
    // rule targets React state and does not apply to these external objects.
    files: ["src/scene/**/*.{ts,tsx}"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "data/**",
    "public/city/**",
  ]),
]);

export default eslintConfig;
