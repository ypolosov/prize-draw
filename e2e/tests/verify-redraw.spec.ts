import { expect, test } from '@playwright/test';
import { recompute, sha256 } from './verify';

// Страница проверки пересчитывает и повторные выборы; ответ API подменён, зерно настоящее.
const SEED = 'e2e-зерно-повтора';
const PEOPLE = ['анна', 'борис', 'вера', 'глеб', 'дина'];
const chain = recompute(SEED, PEOPLE, 3);

const w = (position: number, participant: string) => ({
  position,
  participant,
  status: 'pending',
  confirmBy: '2026-01-04T00:00:00.000Z',
});

async function open(page: import('@playwright/test').Page, winners: unknown[]) {
  const draw = {
    id: 9002,
    title: 'e2e проверка повтора',
    prizes: 2,
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2026-01-02T00:00:00.000Z',
    seedHash: sha256(SEED),
    entries: PEOPLE.length,
    seed: SEED,
    drawnAt: '2026-01-02T00:00:00.000Z',
    participants: PEOPLE,
    winners,
    unclaimed: [{ position: 1, participant: chain[0] }],
  };
  await page.route('**/api/draws/9002', (r) => r.fulfill({ json: draw }));
  await page.goto('/#/draws/9002');
}

test('проверка сходится после повторного выбора', async ({ page }) => {
  await open(page, [w(1, chain[2] as string), w(2, chain[1] as string)]);
  await expect(page.getByTestId('fairness')).toHaveText('результат честный: зерно и победители сходятся');
});

test('подмена победителя повтора - расхождение', async ({ page }) => {
  const other = PEOPLE.find((p) => !chain.includes(p)) as string;
  await open(page, [w(1, other), w(2, chain[1] as string)]);
  await expect(page.getByTestId('fairness')).toHaveText('результат НЕ сходится с зерном');
});
