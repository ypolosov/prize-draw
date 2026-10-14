# ADR-1. Стек и проверки

Статус: принято, 15.10.2026.

Решение: фронтенд - TypeScript, React, Vite, отдаёт nginx; API - TypeScript, NestJS; база - PostgreSQL; сквозные проверки - Playwright; модульные - Vitest. TypeScript 6: NestJS нужны метаданные декораторов. Линтер и форматирование - Biome, архитектурные правила - dependency-cruiser (`.dependency-cruiser.cjs`).

Команды проверок объявлены в `.factory/config.yml`: их вызывают CI и фабрика.
