import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Draw, type Winner } from '../src/api';
import { canRedraw, NO_CANDIDATES, redrawMessage, runRedraw } from '../src/redraw';

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

const draw = (winners: Winner[]): Draw => ({
  id: 1,
  title: 'Весна',
  prizes: 3,
  opensAt: '',
  closesAt: '',
  seedHash: '',
  entries: 5,
  winners,
});
const fallback = () => 'ошибка API';

describe('повтор по нажатию кнопки', () => {
  it('вызывает API с местом приза и отдаёт нового победителя', async () => {
    const next = draw([w('pending', 'Олег Т.')]);
    const call = vi.fn().mockResolvedValue(next);
    const out = await runRedraw(call, w('unclaimed'), fallback);
    expect(call).toHaveBeenCalledWith(3);
    expect(out.draw).toBe(next);
    expect(out.failed).toBe(false);
    expect(out.message).toContain('Олег Т.');
  });
  it('если кандидатов нет - сообщение, победитель прежний', async () => {
    const call = vi.fn().mockRejectedValue(new ApiError('нет кандидатов', undefined, 409));
    const out = await runRedraw(call, w('unclaimed'), fallback);
    expect(out).toEqual({ message: NO_CANDIDATES, failed: true });
  });
  it('другая ошибка API показывается как есть, не как «некому»', async () => {
    const call = vi.fn().mockRejectedValue(new ApiError('сбой сервера', undefined, 500));
    const out = await runRedraw(call, w('unclaimed'), fallback);
    expect(out).toEqual({ message: 'ошибка API', failed: true });
  });
});
