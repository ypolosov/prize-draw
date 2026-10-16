// Модульные тесты: чистые правила предметной области (api/test) и логика экранов веба (web/test) -
// без DOM: логику экрана выносят в чистые функции web/src/*.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/test/**/*.test.ts', 'web/test/**/*.test.ts'],
    environment: 'node',
  },
});
