import { expect, it } from 'vitest';
import type { Draw, Winner } from '../src/api';
import { prizeView } from '../src/prize';
import { pickWinners, sha256, verifyDraw } from '../src/verify';

const winner: Winner = {
  position: 1,
  selection: 1,
  participant: 'Анна',
  status: 'unclaimed',
  confirmBy: '2026-10-18T00:00:00Z',
};

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
