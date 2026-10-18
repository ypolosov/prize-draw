import { describe, expect, it } from 'vitest';
import { canRedraw } from '../src/redraw';

describe('кнопка «Разыграть заново»', () => {
  it('есть у приза, который не подтвердили за 3 дня', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });
  it('нет, пока победитель может подтвердить приз', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
  it('нет у подтверждённого приза', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });
});
