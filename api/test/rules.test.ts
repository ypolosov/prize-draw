import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  checkConfirm,
  checkEntry,
  checkRedraw,
  checkTitle,
  pickRedraw,
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

  it('R3: несуществующая календарная дата рождения отклоняется (DRAW-122)', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    for (const bad of ['0297-13-45', '2000-02-30', '2001-02-29', '2000-00-10', '2000-04-31'])
      expect(rule(() => checkEntry(period, bad, now))).toBe('R3');
    expect(ageOn('2000-02-29', now)).toBe(26);
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

describe('повтор невостребованного приза', () => {
  const people = ['dina', 'anna', 'boris', 'vera', 'gleb', 'egor'];

  it('повтор - шаг "pick:3" той же последовательности, новое зерно не нужно', () => {
    const chosen = pickWinners('зерно-1', people, 3);
    const rest = [...people].sort().filter((p) => !chosen.includes(p));
    const n = createHmac('sha256', 'зерно-1').update('pick:3').digest().readBigUInt64BE(0);
    expect(pickRedraw('зерно-1', people, chosen)).toBe(rest[Number(n % BigInt(rest.length))]);
  });

  it('совпадает с пересчётом: pickWinners на призов больше даёт того же победителя', () => {
    const chosen = pickWinners('зерно-2', people, 3);
    const next = pickRedraw('зерно-2', people, chosen) as string;
    expect(next).toBe(pickWinners('зерно-2', people, 4)[3]);
    expect(pickRedraw('зерно-2', people, [...chosen, next])).toBe(pickWinners('зерно-2', people, 5)[4]);
  });

  it('R5: выбранные, включая не подтвердившего, не участвуют; порядок участников не важен', () => {
    const chosen = pickWinners('s', people, 5);
    const w = pickRedraw('s', [...people].reverse(), chosen);
    expect(w).toBe(people.find((p) => !chosen.includes(p)));
  });

  it('кандидатов не осталось - null', () => {
    expect(pickRedraw('s', people, pickWinners('s', people, 6))).toBeNull();
    expect(pickRedraw('s', [], [])).toBeNull();
  });

  it('R6: повтор только после срока и только для неподтверждённого приза', () => {
    const assigned = new Date('2026-10-10T00:00:00Z');
    expect(checkRedraw(assigned, false, new Date('2026-10-13T00:00:01Z'))).toBeNull();
    expect(checkRedraw(assigned, false, new Date('2026-10-13T00:00:00Z'))).toContain('3 дня');
    expect(checkRedraw(assigned, true, new Date('2026-10-20T00:00:00Z'))).toContain('подтверждён');
  });
});
