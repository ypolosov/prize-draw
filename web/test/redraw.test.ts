import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api';
import { canRedraw, redrawErrorText } from '../src/redraw';

describe('кнопка «Разыграть заново»', () => {
  it('есть только у невостребованного приза', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });

  it('без кандидатов: сообщение, что кандидатов не осталось', () => {
    expect(redrawErrorText(new ApiError('x', undefined, 422))).toContain('не осталось кандидатов');
  });

  it('сообщения без кодов правил', () => {
    for (const s of [409, 422, 500]) expect(redrawErrorText(new ApiError('R6', 'R6', s))).not.toMatch(/R\d/);
  });
});
