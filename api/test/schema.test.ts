import { describe, expect, it } from 'vitest';
import { SCHEMA } from '../src/db';

describe('схема unclaimed_winners (DRAW-46)', () => {
  it('убирает устаревший обязательный столбец step со стендовых баз', () => {
    expect(SCHEMA).toContain('ALTER TABLE unclaimed_winners DROP COLUMN IF EXISTS step');
  });

  it('не требует step при создании таблицы', () => {
    const create = /CREATE TABLE IF NOT EXISTS unclaimed_winners \(([\s\S]*?)\n\);/.exec(SCHEMA);
    expect(create?.[1]).not.toMatch(/\bstep\b/);
  });
});
