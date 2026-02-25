import { pathsToModuleNameMapper } from "ts-jest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse tsconfig.json
const tsconfig = JSON.parse(readFileSync("./tsconfig.json", "utf8"));
const compilerOptions = tsconfig.compilerOptions;

export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: [
    "**/__tests__/router/**/*.test.tsx",
    "**/__tests__/integration/**/*.test.tsx",
  ],
  collectCoverageFrom: [
    "src/router/**/*.{ts,tsx}",
    "src/store/navigationStore.tsx",
    "src/store/navigationStateMachine.ts",
    "!src/**/*.d.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup-router.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: "<rootDir>/",
      useESM: true,
    }),
    "^figures$": "<rootDir>/tests/__mocks__/figures.ts",
    "^is-unicode-supported$": "<rootDir>/tests/__mocks__/is-unicode-supported.ts",
    "^conf$": "<rootDir>/tests/__mocks__/conf.ts",
    "^signal-exit$": "<rootDir>/tests/__mocks__/signal-exit.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          ...compilerOptions,
          rootDir: ".",
          module: "ESNext",
          moduleResolution: "Node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(ink-testing-library|ink|chalk|cli-cursor|restore-cursor|onetime|mimic-fn|signal-exit|strip-ansi|ansi-regex|ansi-styles|wrap-ansi|string-width|emoji-regex|eastasianwidth|cli-boxes|camelcase|widest-line|yoga-wasm-web)/)",
  ],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testTimeout: 30000,
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  clearMocks: true,
  restoreMocks: true,
};
