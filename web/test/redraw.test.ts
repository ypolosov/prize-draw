import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { Draw, Winner } from '../src/api';
import { prizeView, redrawPrize } from '../src/prize';
import { Results } from '../src/Results';
import { pickWinners, sha256, verifyDraw } from '../src/verify';

const winner: Winner = {
  position: 1,
  selection: 1,
  participant: 'Анна',
  status: 'unclaimed',
  confirmBy: '2026-10-18T00:00:00Z',
};

const drawWith = (winners: Winner[]): Draw => ({
  id: 144,
  title: 'Весенний розыгрыш',
  prizes: winners.length,
  entries: 4,
  opensAt: '',
  closesAt: '',
  seedHash: '',
  winners,
});

it.each(['pending', 'confirmed', 'unclaimed'] as const)(
  'показывает кнопку повтора только для невостребованного приза: %s',
  (status) => {
    const draw = drawWith([{ ...winner, status }]);
    const html = renderToStaticMarkup(createElement(Results, { draw, update: vi.fn() }));
    const buttons = html.match(/<button[^>]*>Разыграть заново<\/button>/g) ?? [];
    expect(buttons).toHaveLength(status === 'unclaimed' ? 2 : 0);
  },
);

it('действие кнопки вызывает повтор нужного приза и показывает нового победителя', async () => {
  const draw = drawWith([winner]);
  const replacement: Winner = { ...winner, selection: 2, participant: 'Олег Т.', status: 'pending' };
  const repeated = { ...draw, winners: [replacement], selectionHistory: [winner, replacement] };
  const request = vi.fn().mockResolvedValue(repeated);

  const updated = await redrawPrize(draw, winner.position, request);

  expect(request).toHaveBeenCalledExactlyOnceWith(144, 1);
  const html = renderToStaticMarkup(createElement(Results, { draw: updated, update: vi.fn() }));
  expect(html).toContain('У приза новый победитель — Олег Т.');
  expect(html).toContain('Победитель: Олег Т.');
  expect(html).not.toContain('Разыграть заново</button>');
});

it.each(['pending', 'confirmed'] as const)('не вызывает повтор для приза со статусом %s', async (status) => {
  const draw = drawWith([{ ...winner, status }]);
  const request = vi.fn();
  await expect(redrawPrize(draw, winner.position, request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

it('невостребованный приз предлагает повтор, подтверждённый — нет', () => {
  expect(prizeView(winner).canRedraw).toBe(true);
  expect(prizeView({ ...winner, status: 'confirmed' }).canRedraw).toBe(false);
  expect(prizeView({ ...winner, status: 'pending' }).canRedraw).toBe(false);
});

it('проверяет исходный выбор, несколько повторов и текущего победителя', async () => {
  const participants = ['Анна', 'Борис', 'Вера', 'Глеб'];
  const selected = await pickWinners('seed', participants, 3);
  const history = selected.map((participant, i) => ({ ...winner, participant, selection: i + 1 }));
  const draw: Draw = {
    id: 1,
    title: 'Тест',
    prizes: 1,
    entries: 4,
    opensAt: '',
    closesAt: '',
    seed: 'seed',
    seedHash: await sha256('seed'),
    participants,
    winners: [history[2] as Winner],
    selectionHistory: history,
  };
  expect(await verifyDraw(draw)).toBe(true);
  expect(await verifyDraw({ ...draw, winners: [history[0] as Winner] })).toBe(false);
  expect(await verifyDraw({ ...draw, seedHash: 'подмена' })).toBe(false);
  expect(
    await verifyDraw({
      ...draw,
      selectionHistory: history.map((w, i) => (i === 1 ? { ...w, participant: 'подмена' } : w)),
    }),
  ).toBe(false);
  expect(await verifyDraw({ ...draw, participants: undefined })).toBe(false);
});
