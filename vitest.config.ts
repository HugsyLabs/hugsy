import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '*.config.*',
        '**/types/**',
        'examples/**', // Example configurations
        'plugins/**', // Example plugins
        '**/test-temp/**', // Temporary test artifacts
        '**/__tests__/**', // Test directories
        '**/*.test.ts', // Test files
        '**/*.spec.ts', // Spec files
      ],
      thresholds: {
        branches: 65, // Current: 68.42%
        functions: 60, // Current: 65%
        lines: 30, // Current: 31.37%
        statements: 30, // Current: 31.37%
      },
    },
    testTimeout: 30000, // Integration tests need more time
    include: [
      'packages/**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    // Different timeouts for different test types
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
});
