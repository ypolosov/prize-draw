import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  checkConfirm,
  checkEntry,
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
  const people = ['анна', 'борис', 'вера', 'глеб', 'дарья', 'егор'];

  it('следующий кандидат той же последовательности среди ещё не выбранных', () => {
    const first = pickWinners('зерно-r', people, 2);
    const third = pickWinners('зерно-r', people, 3)[2];
    expect(pickNext('зерно-r', people, first)).toBe(third);
  });

  it('индекс - HMAC-SHA256(зерно, "pick:i") по модулю числа оставшихся', () => {
    const picked = ['анна', 'борис'];
    const rest = people.filter((p) => !picked.includes(p)).sort();
    const n = createHmac('sha256', 'зерно-r').update('pick:2').digest().readBigUInt64BE(0);
    expect(pickNext('зерно-r', people, picked)).toBe(rest[Number(n % BigInt(rest.length))]);
  });

  it('не выбирает ранее выбранных, в том числе не подтвердившего приз', () => {
    let picked = pickWinners('зерно-q', people, 2);
    for (let i = 0; i < 4; i++) {
      const next = pickNext('зерно-q', people, picked);
      expect(next).not.toBeNull();
      expect(picked).not.toContain(next);
      picked = [...picked, next as string];
    }
    expect(new Set(picked).size).toBe(6);
  });

  it('цепочка повторов совпадает с пересчётом всей последовательности из зерна', () => {
    let picked = pickWinners('зерно-v', people, 2);
    while (picked.length < people.length) picked = [...picked, pickNext('зерно-v', people, picked) as string];
    expect(picked).toEqual(pickWinners('зерно-v', people, people.length));
  });

  it('кандидатов нет - null', () => {
    expect(pickNext('s', ['a', 'b'], ['a', 'b'])).toBeNull();
    expect(pickNext('s', [], [])).toBeNull();
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
