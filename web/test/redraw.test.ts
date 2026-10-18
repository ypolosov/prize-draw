import { describe, expect, it } from 'vitest';
import type { Winner } from '../src/api';
import { canRedraw, redrawOutcome, unclaimedWinners } from '../src/redraw';

const w = (position: number, participant: string, status: Winner['status']): Winner => ({
  position,
  participant,
  status,
  confirmBy: '2026-10-21T00:00:00Z',
});

// Сценарии DRAW-127: кнопка у невостребованного приза, нет кнопки до срока, успешный повтор.
describe('повтор невостребованного приза', () => {
  it('кнопка есть у приза, не подтверждённого за 3 дня', () => {
    expect(canRedraw(w(1, 'мария', 'unclaimed'))).toBe(true);
  });

  it('кнопки нет у подтверждённого приза и пока срок не истёк', () => {
    expect(canRedraw(w(1, 'анна', 'confirmed'))).toBe(false);
    expect(canRedraw(w(2, 'игорь', 'pending'))).toBe(false);
  });

  it('невостребованные призы выбираются из списка победителей', () => {
    const all = [w(1, 'анна', 'confirmed'), w(2, 'игорь', 'pending'), w(3, 'мария', 'unclaimed')];
    expect(unclaimedWinners(all).map((x) => x.position)).toEqual([3]);
  });

  it('успешный повтор: новый победитель на том же месте', () => {
    const before = [w(1, 'анна', 'confirmed'), w(2, 'мария', 'unclaimed')];
    const after = [w(1, 'анна', 'confirmed'), w(2, 'олег', 'pending')];
    const r = redrawOutcome(before, after, 2);
    expect(r?.previous).toBe('мария');
    expect(r?.current.participant).toBe('олег');
  });

  it('победитель не сменился - повтор не прошёл', () => {
    const same = [w(1, 'мария', 'unclaimed')];
    expect(redrawOutcome(same, same, 1)).toBeUndefined();
  });
});
