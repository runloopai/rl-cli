import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse tsconfig.json
const tsconfig = JSON.parse(readFileSync('./tsconfig.json', 'utf8'));
const compilerOptions = tsconfig.compilerOptions;

export default {
  // Use the default ESM preset for ts-jest
  preset: 'ts-jest/presets/default-esm',
  
  // Test environment
  testEnvironment: 'node',
  
  // Test discovery
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    // Handle .js extensions for TypeScript files in ESM
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Map TypeScript path aliases to actual file paths
    ...pathsToModuleNameMapper(compilerOptions.paths, { 
      prefix: '<rootDir>/',
      useESM: true 
    }),
      // Mock problematic ESM modules
      '^figures$': '<rootDir>/tests/__mocks__/figures.ts',
      '^is-unicode-supported$': '<rootDir>/tests/__mocks__/is-unicode-supported.ts',
      '^conf$': '<rootDir>/tests/__mocks__/conf.ts',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        ...compilerOptions,
        // Override some options for Jest
        rootDir: '.',
        module: 'ESNext',
        moduleResolution: 'Node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      }
    }],
  },
  
  // Transform ignore patterns for node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(conf|@runloop|ink|react|ink-big-text|ink-gradient|ink-spinner|ink-text-input|ink-select-input|ink-box|ink-text|ink-testing-library|figures|is-unicode-supported)/)'
  ],
  
  // Treat these extensions as ESM
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  
  // Test timeout
  testTimeout: 30000,
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Require all component files to have test coverage
    './src/components/': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
};


