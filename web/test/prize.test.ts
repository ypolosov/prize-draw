import { describe, expect, it } from 'vitest';
import { canRedraw, redrawErrorText } from '../src/prize';

// Экран приза: кнопка «Разыграть заново» только для невостребованного приза.
describe('кнопка «Разыграть заново»', () => {
  it('доступна, если победитель не подтвердил приз в срок', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });
  it('скрыта, если приз подтверждён', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });
  it('скрыта, если срок подтверждения не истёк', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
});

describe('сообщение об ошибке повтора', () => {
  it('говорит, что победитель прежний, и не показывает коды правил', () => {
    const text = redrawErrorText('R5: нет кандидатов');
    expect(text).toContain('Прежний победитель');
    expect(text).toContain('нет кандидатов');
    expect(text).not.toMatch(/R\d/);
  });
  it('без причины даёт общий текст', () => {
    expect(redrawErrorText('')).toContain('Прежний победитель');
  });
});
