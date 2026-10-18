import { describe, expect, it } from 'vitest';
import type { Winner } from '../src/api';
import { canRedraw, redrawMessage } from '../src/redraw';

const w = (status: Winner['status'], participant = 'Мария С.', position = 3): Winner => ({
  position,
  participant,
  status,
  confirmBy: '2026-10-21T10:00:00.000Z',
});

describe('кнопка «Разыграть заново»', () => {
  it('есть только у невостребованного приза', () => {
    expect(canRedraw(w('unclaimed'))).toBe(true);
  });
  it('нет у подтверждённого приза', () => {
    expect(canRedraw(w('confirmed'))).toBe(false);
  });
  it('нет, пока срок подтверждения не прошёл', () => {
    expect(canRedraw(w('pending'))).toBe(false);
  });
});

describe('сообщение после повтора', () => {
  it('называет нового победителя', () => {
    expect(redrawMessage(3, 'Мария С.', [w('pending', 'Олег Т.')])).toBe(
      'У приза 3 новый победитель - Олег Т.: у него есть 3 дня, чтобы подтвердить приз.',
    );
  });
  it('если победитель не появился - говорит об этом', () => {
    expect(redrawMessage(3, 'Мария С.', [w('unclaimed')])).toBe('Победитель приза 3 не изменился: Мария С.');
  });
});
