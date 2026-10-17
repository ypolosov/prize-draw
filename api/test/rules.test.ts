import { describe, expect, it } from 'vitest';
import {
  ageOn,
  checkConfirm,
  checkEntry,
  checkRedraw,
  checkTitle,
  pickNext,
  pickWinners,
  RuleViolation,
  seedHash,
} from '../src/domain/rules';

const period = { opensAt: new Date('2026-10-01T00:00:00Z'), closesAt: new Date('2026-10-10T00:00:00Z') };
const rule = (f: () => void) => {
  try {
    f();
  } catch (e) {
    return e instanceof RuleViolation ? e.rule : 'other';
  }
  return undefined;
};

describe('правила розыгрыша', () => {
  it('R2: заявка только в период розыгрыша', () => {
    expect(rule(() => checkEntry(period, '2000-01-01', new Date('2026-10-05T00:00:00Z')))).toBeUndefined();
    expect(rule(() => checkEntry(period, '2000-01-01', new Date('2026-09-30T23:59:59Z')))).toBe('R2');
    expect(rule(() => checkEntry(period, '2000-01-01', period.closesAt))).toBe('R2');
  });

  it('R3: участнику 18 лет или больше', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    expect(ageOn('2008-10-05', now)).toBe(18);
    expect(ageOn('2008-10-06', now)).toBe(17);
    expect(rule(() => checkEntry(period, '2008-10-06', now))).toBe('R3');
    expect(rule(() => checkEntry(period, 'не дата', now))).toBe('R3');
  });

  it('R4: победители воспроизводимы из зерна, хэш зерна публикуется заранее', () => {
    const people = ['dina', 'anna', 'boris', 'vera', 'gleb'];
    const a = pickWinners('зерно-1', people, 2);
    expect(pickWinners('зерно-1', [...people].reverse(), 2)).toEqual(a);
    expect(seedHash('зерно-1')).toMatch(/^[0-9a-f]{64}$/);
    const other = Array.from({ length: 20 }, (_, i) => pickWinners(`зерно-${i}`, people, 2).join());
    expect(new Set(other).size).toBeGreaterThan(1);
  });

  it('R5: один приз одному участнику, призов не больше участников', () => {
    const w = pickWinners('s', ['a', 'b', 'c', 'a'], 5);
    expect(w).toHaveLength(3);
    expect(new Set(w).size).toBe(3);
  });

  it('R6: приз подтверждают за 3 дня', () => {
    const drawn = new Date('2026-10-10T00:00:00Z');
    expect(rule(() => checkConfirm(drawn, new Date('2026-10-13T00:00:00Z')))).toBeUndefined();
    expect(rule(() => checkConfirm(drawn, new Date('2026-10-13T00:00:01Z')))).toBe('R6');
  });
});

describe('повтор невостребованного приза', () => {
  const people = ['dina', 'anna', 'boris', 'vera', 'gleb', 'olga'];

  it('R4: повтор - следующий шаг последовательности, совпадает с пересчётом из зерна', () => {
    const picked = pickWinners('зерно-1', people, 2);
    expect(pickNext('зерно-1', people, picked)).toBe(pickWinners('зерно-1', people, 3)[2]);
  });

  it('R4: несколько повторов подряд тоже совпадают с пересчётом', () => {
    const all = pickWinners('зерно-2', people, 5);
    expect(pickNext('зерно-2', [...people].reverse(), all.slice(0, 4))).toBe(all[4]);
  });

  it('R5: не выбирает уже выбранных, в том числе не подтвердившего приз', () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickWinners(`s-${i}`, people, 3);
      const next = pickNext(`s-${i}`, people, picked);
      expect(next).toBeDefined();
      expect(picked).not.toContain(next);
    }
  });

  it('нет оставшихся участников - нет кандидата', () => {
    expect(pickNext('s', people, pickWinners('s', people, 6))).toBeUndefined();
    expect(pickNext('s', [], [])).toBeUndefined();
  });

  it('R6: повтор только после срока подтверждения', () => {
    const drawn = new Date('2026-10-10T00:00:00Z');
    expect(rule(() => checkRedraw(drawn, false, new Date('2026-10-13T00:00:00Z')))).toBe('R6');
    expect(rule(() => checkRedraw(drawn, false, new Date('2026-10-13T00:00:01Z')))).toBeUndefined();
  });

  it('R6: подтверждённый приз не повторяют', () => {
    const drawn = new Date('2026-10-10T00:00:00Z');
    expect(rule(() => checkRedraw(drawn, true, new Date('2026-10-20T00:00:00Z')))).toBe('R6');
  });
});

describe('название розыгрыша', () => {
  it('принимает от 3 до 120 символов', () => {
    expect(checkTitle('abc')).toBeNull();
    expect(checkTitle('а'.repeat(120))).toBeNull();
  });
  it('отклоняет слишком короткое и слишком длинное', () => {
    expect(checkTitle('ab')).toContain('от 3 до 120');
    expect(checkTitle('')).toContain('от 3 до 120');
    expect(checkTitle('а'.repeat(121))).toContain('от 3 до 120');
  });
  it('отклоняет пробелы по краям', () => {
    expect(checkTitle(' abc')).toContain('пробел');
    expect(checkTitle('abc ')).toContain('пробел');
    expect(checkTitle('   ')).not.toBeNull();
  });
  it('отклоняет не строку', () => {
    expect(checkTitle(undefined)).toContain('строк');
    expect(checkTitle(42)).toContain('строк');
  });
});
