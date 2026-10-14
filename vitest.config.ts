// Модульные тесты: чистые правила предметной области (api/test).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/test/**/*.test.ts'],
    environment: 'node',
  },
});
