import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Draw } from '../src/api';
import { canRedraw, redrawPrize } from '../src/redraw';

const draw = (participant: string, status: Draw['winners'][number]['status']): Draw => ({
  id: 7,
  title: 'Весенний',
  prizes: 1,
  opensAt: '2026-01-01T00:00:00Z',
  closesAt: '2026-01-02T00:00:00Z',
  seedHash: 'h',
  entries: 3,
  drawnAt: '2026-01-03T00:00:00Z',
  winners: [{ position: 1, participant, status, confirmBy: '2026-01-06T00:00:00Z' }],
});

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

describe('повторный розыгрыш приза', () => {
  it('отправляет id розыгрыша и позицию приза и показывает нового победителя', async () => {
    const current = draw('Анна', 'unclaimed');
    const redraw = vi.fn().mockResolvedValue(draw('Борис', 'pending'));
    const r = await redrawPrize(redraw, current, 1);
    expect(redraw).toHaveBeenCalledWith(7, 1);
    expect(r.draw.winners[0].participant).toBe('Борис');
    expect(r.message).toBe('приз разыгран заново');
  });
  it('при отказе API показывает ошибку и оставляет прежнего победителя', async () => {
    const current = draw('Анна', 'unclaimed');
    const redraw = vi.fn().mockRejectedValue(new ApiError('Нет оставшихся участников'));
    const r = await redrawPrize(redraw, current, 1);
    expect(r.draw).toBe(current);
    expect(r.draw.winners[0].participant).toBe('Анна');
    expect(r.message).toBe('Нет оставшихся участников');
  });
  it('если API недоступен, говорит об этом и не меняет победителя', async () => {
    const current = draw('Анна', 'unclaimed');
    const r = await redrawPrize(vi.fn().mockRejectedValue(new TypeError('fetch')), current, 1);
    expect(r.draw).toBe(current);
    expect(r.message).toBe('API недоступен');
  });
});
