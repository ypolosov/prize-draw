import { describe, expect, it } from 'vitest';
import { canRedraw, redrawFailure } from '../src/redraw';

describe('повтор невостребованного приза', () => {
  it('кнопка доступна, когда приз не подтверждён за 3 дня', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });

  it('кнопки нет, пока срок не прошёл или приз подтверждён', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });

  it('сообщение об отказе называет причину и говорит, что победители прежние', () => {
    const text = redrawFailure('кандидатов не осталось');
    expect(text).toContain('кандидатов не осталось');
    expect(text).toContain('не изменился');
  });
});
