import { pathsToModuleNameMapper } from "ts-jest";
import { readFileSync } from "fs";

// Read and parse tsconfig.json
const tsconfig = JSON.parse(readFileSync("./tsconfig.json", "utf8"));
const compilerOptions = tsconfig.compilerOptions;

export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/e2e/**/*.test.ts"],

  setupFilesAfterEnv: ["<rootDir>/tests/setup-e2e.ts"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: "<rootDir>/",
      useESM: true,
    }),
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

  extensionsToTreatAsEsm: [".ts"],

  // e2e tests may take a while (devbox creation, transfers, etc.)
  testTimeout: 180_000,

  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  restoreMocks: true,
};
