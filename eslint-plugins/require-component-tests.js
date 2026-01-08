/**
 * ESLint plugin to enforce that all component files have corresponding test files.
 * 
 * This plugin checks that for each .tsx file in src/components/,
 * there exists a corresponding .test.tsx file in tests/__tests__/components/
 */

import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require test files for all component files',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      missingTest: 'Component "{{componentName}}" is missing a test file. Expected: {{expectedPath}}',
    },
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.getFilename();
        
        // Only check files in src/components/
        if (!filename.includes('src/components/') || !filename.endsWith('.tsx')) {
          return;
        }
        
        // Skip test files themselves
        if (filename.includes('.test.') || filename.includes('.spec.')) {
          return;
        }
        
        const componentName = basename(filename, '.tsx');
        
        // Find the project root (go up from src/components)
        const srcIndex = filename.indexOf('src/components/');
        const projectRoot = filename.substring(0, srcIndex);
        
        // Expected test file path
        const expectedTestPath = join(
          projectRoot,
          'tests/__tests__/components',
          `${componentName}.test.tsx`
        );
        
        // Check if test file exists
        if (!existsSync(expectedTestPath)) {
          context.report({
            node,
            messageId: 'missingTest',
            data: {
              componentName,
              expectedPath: `tests/__tests__/components/${componentName}.test.tsx`,
            },
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'require-component-tests': rule,
  },
};

