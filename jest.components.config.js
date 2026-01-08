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
  // Use the default ESM preset for ts-jest
  preset: "ts-jest/presets/default-esm",

  // Test environment
  testEnvironment: "node",

  // Test discovery - only component tests
  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/components/**/*.test.tsx"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/components/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
  ],

  // Setup files - use component-specific setup
  setupFilesAfterEnv: ["<rootDir>/tests/setup-components.ts"],

  // Module name mapping for path aliases
  moduleNameMapper: {
    // Handle .js extensions for TypeScript files in ESM
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Map TypeScript path aliases to actual file paths
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: "<rootDir>/",
      useESM: true,
    }),
    // Mock problematic ESM modules with TypeScript mocks
    "^figures$": "<rootDir>/tests/__mocks__/figures.ts",
    "^is-unicode-supported$": "<rootDir>/tests/__mocks__/is-unicode-supported.ts",
    "^conf$": "<rootDir>/tests/__mocks__/conf.ts",
    "^signal-exit$": "<rootDir>/tests/__mocks__/signal-exit.ts",
  },

  // Transform configuration
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          ...compilerOptions,
          // Override some options for Jest
          rootDir: ".",
          module: "ESNext",
          moduleResolution: "Node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },

  // Transform these ESM packages
  transformIgnorePatterns: [
    "node_modules/(?!(ink-testing-library|ink|chalk|cli-cursor|restore-cursor|onetime|mimic-fn|signal-exit|strip-ansi|ansi-regex|ansi-styles|wrap-ansi|string-width|emoji-regex|eastasianwidth|cli-boxes|camelcase|widest-line|yoga-wasm-web)/)",
  ],

  // Treat these extensions as ESM
  extensionsToTreatAsEsm: [".ts", ".tsx"],

  // Test timeout
  testTimeout: 30000,

  // Coverage thresholds for components - starting low, increase over time
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 30,
      statements: 30,
    },
  },

  // Module file extensions
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};
