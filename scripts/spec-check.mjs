// Проверка спецификаций OpenSpec (npm run spec:validate): схема фабрики, изменения и живые
// спецификации, готовность каждого изменения к работе агентов (есть все артефакты, которых
// требует apply) и пример изменения: хорошее принимается, неполное и без SHALL - нет.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bin = join(root, 'node_modules', '.bin', 'openspec');
const env = { ...process.env, OPENSPEC_TELEMETRY: '0' };
const run = (cwd, ...args) =>
  execFileSync(bin, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ok = (cwd, ...args) => {
  try {
    run(cwd, ...args);
    return true;
  } catch {
    return false;
  }
};

// Не хватает артефактов, без которых агенту нельзя начинать: то, что требует apply, и всё, от
// чего оно зависит. Дизайн - по надобности (так в схеме), пропущенное (skipped) не нужно.
const OPTIONAL = new Set(['design']);
function missing(cwd, change) {
  const s = JSON.parse(run(cwd, 'status', '--change', change, '--json'));
  const byId = new Map(s.artifacts.map((a) => [a.id, a]));
  const need = new Set();
  const walk = (id) => {
    if (need.has(id) || OPTIONAL.has(id)) return;
    need.add(id);
    for (const r of byId.get(id)?.requires ?? []) walk(r);
  };
  for (const id of s.applyRequires) walk(id);
  return [...need].filter((id) => !['done', 'skipped'].includes(byId.get(id)?.status));
}

function changes(cwd) {
  const dir = join(cwd, 'openspec', 'changes');
  return existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'archive')
        .map((d) => d.name)
    : [];
}

function check(cwd) {
  const failed = [];
  for (const args of [
    ['schema', 'validate', 'factory'],
    ['validate', '--all', '--strict'],
  ]) {
    try {
      run(cwd, ...args);
    } catch (e) {
      failed.push(`openspec ${args.join(' ')}:\n${e.stdout ?? ''}${e.stderr ?? ''}`.trim());
    }
  }
  if (failed.length) return failed;
  return [
    // Фабрика находит изменение задачи по ключу в начале имени: draw-12-redraw для DRAW-12.
    ...changes(cwd)
      .filter((c) => !KEYED.test(c))
      .map((c) => `изменение ${c}: имя без ключа задачи - нужно <ключ>-<имя>, например draw-12-redraw`),
    ...changes(cwd)
      .map((c) => [c, missing(cwd, c)])
      .filter(([, m]) => m.length)
      .map(([c, m]) => `изменение ${c} не готово к работе агентов: нет ${m.join(', ')}`),
  ];
}
const KEYED = /^[a-z][a-z0-9]*-\d+(-[a-z0-9]+)*$/;

const SAMPLE = {
  'proposal.md':
    '## Why\n\nЗадача: DRAW-99. Пример изменения для проверки схемы фабрики.\n\n## What Changes\n\n- Повтор розыгрыша берёт следующего кандидата.\n\n## Capabilities\n\n### New Capabilities\n- `redraw`: повтор розыгрыша невостребованного приза.\n\n### Modified Capabilities\n\n## Impact\n\nAPI розыгрыша.\n',
  'specs/redraw/spec.md':
    '## Purpose\n\nПовтор розыгрыша невостребованного приза из той же последовательности кандидатов.\n\n## ADDED Requirements\n\n### Requirement: Повтор берёт следующего кандидата\nThe system SHALL выбрать следующего кандидата из той же последовательности.\n\n#### Scenario: Приз не подтверждён\n- **WHEN** организатор запускает повтор\n- **THEN** побеждает следующий кандидат\n',
  'tasks.md': '## 1. API\n\n- [ ] 1.1 Повтор розыгрыша [сценарии - Приз не подтверждён]\n',
  'test-plan.md':
    '# Test Plan\n\n## Сквозные проверки\n\n| Задача | Сценарий | Файл | Что проверяется |\n|---|---|---|---|\n| 1.1 | Приз не подтверждён | e2e/tests/redraw.spec.ts | повтор и новый победитель |\n',
};

// Пример во временной копии openspec/: хорошее изменение готово, без плана проверки или без
// замысла - не готово, требование без SHALL и имя без ключа задачи отклоняются.
function smoke() {
  const tmp = mkdtempSync(join(tmpdir(), 'spec-'));
  try {
    // Только настройки и схема: изменения и спецификации проекта в пример не попадают.
    for (const p of ['config.yaml', 'schemas'])
      cpSync(join(root, 'openspec', p), join(tmp, 'openspec', p), { recursive: true });
    for (const p of ['specs', 'changes']) mkdirSync(join(tmp, 'openspec', p), { recursive: true });
    const name = 'draw-99-sample';
    run(tmp, 'new', 'change', name);
    const dir = join(tmp, 'openspec', 'changes', name);
    for (const [path, text] of Object.entries(SAMPLE)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const fails = [];
    if (check(tmp).length) fails.push('хорошее изменение не принято');
    rmSync(join(dir, 'test-plan.md'));
    if (!missing(tmp, name).includes('test-plan')) fails.push('изменение без плана проверки сочтено готовым');
    writeFileSync(join(dir, 'test-plan.md'), SAMPLE['test-plan.md']);
    rmSync(join(dir, 'proposal.md'));
    if (!missing(tmp, name).includes('proposal')) fails.push('изменение без замысла сочтено готовым');
    writeFileSync(join(dir, 'proposal.md'), SAMPLE['proposal.md']);
    writeFileSync(
      join(dir, 'specs', 'redraw', 'spec.md'),
      SAMPLE['specs/redraw/spec.md'].replace('The system SHALL', 'Система'),
    );
    if (ok(tmp, 'validate', name, '--strict')) fails.push('требование без SHALL принято');
    writeFileSync(join(dir, 'specs', 'redraw', 'spec.md'), SAMPLE['specs/redraw/spec.md']);
    cpSync(dir, join(tmp, 'openspec', 'changes', 'add-redraw'), { recursive: true });
    if (!check(tmp).some((p) => p.startsWith('изменение add-redraw: имя без ключа')))
      fails.push('изменение без ключа задачи в имени принято');
    return fails.map((f) => `пример схемы: ${f}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const problems = [...check(root), ...smoke()];
for (const p of problems) console.error(p);
if (problems.length) process.exit(1);
console.log(`спецификации в порядке: изменений в работе ${changes(root).length}, пример схемы проходит`);
