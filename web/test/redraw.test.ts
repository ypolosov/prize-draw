import { describe, expect, it } from 'vitest';
import { canRedraw } from '../src/redraw';

describe('кнопка «Разыграть заново»', () => {
  it('есть у приза, который не подтвердили за 3 дня', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });
  it('нет у подтверждённого приза', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });
  it('нет, пока срок подтверждения не истёк', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
});
