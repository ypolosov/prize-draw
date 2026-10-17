import { describe, expect, it, vi } from 'vitest';
import type { Draw } from '../src/api';
import { canRedraw, redrawMessage, runRedraw } from '../src/redraw';

const draw = (participant: string): Draw => ({
  id: 1,
  title: 'т',
  prizes: 1,
  opensAt: '',
  closesAt: '',
  seedHash: '',
  entries: 3,
  winners: [{ position: 1, participant, status: 'pending', confirmBy: '' }],
});

describe('кнопка «Разыграть заново»', () => {
  it('есть у приза, не подтверждённого в срок', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });
  it('нет у подтверждённого приза и у приза, срок которого не истёк', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
});

describe('результат повтора', () => {
  it('называет нового победителя этого приза', () => {
    expect(redrawMessage(draw('Борис'), 1)).toBe('приз 1: новый победитель - Борис');
  });
  it('без победителя на месте - общее сообщение', () => {
    expect(redrawMessage(draw('Борис'), 2)).toBe('приз разыгран заново');
  });
});

describe('нажатие «Разыграть заново»', () => {
  const errorText = (e: unknown) => (e instanceof Error ? e.message : '?');
  it('просит повтор нужного приза и отдаёт нового победителя', async () => {
    const redraw = vi.fn().mockResolvedValue(draw('Борис'));
    const r = await runRedraw(redraw, 7, 1, errorText);
    expect(redraw).toHaveBeenCalledWith(7, 1);
    expect(r.draw?.winners[0].participant).toBe('Борис');
    expect(r.message).toBe('приз 1: новый победитель - Борис');
  });
  it('при ошибке не меняет розыгрыш и показывает сообщение', async () => {
    const redraw = vi.fn().mockRejectedValue(new Error('кандидатов не осталось'));
    const r = await runRedraw(redraw, 7, 1, errorText);
    expect(r.draw).toBeUndefined();
    expect(r.message).toBe('Не удалось разыграть заново: кандидатов не осталось');
  });
});
