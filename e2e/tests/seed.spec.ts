import { expect, test } from '@playwright/test';
import { recompute, sha256 } from './verify';

test('результат воспроизводим из зерна (R4): хэш опубликован заранее, победители пересчитываются', async ({
  page,
  request,
}) => {
  const created = await (
    await request.post('/api/draws', { data: { title: `e2e R4 ${Date.now()}`, prizes: 2 } })
  ).json();
  const published = created.seedHash;
  expect(created.seed).toBeUndefined();
  const people = ['вера', 'анна', 'глеб', 'борис', 'дина'];
  for (const p of people) {
    expect(
      (
        await request.post(`/api/draws/${created.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } })
      ).status(),
    ).toBe(201);
  }
  // До конца приёма заявок победителей не выбирают.
  expect((await request.post(`/api/draws/${created.id}/draw`)).status()).toBe(422);
  await request.post(`/api/draws/${created.id}/close`);
  const drawn = await (await request.post(`/api/draws/${created.id}/draw`)).json();
  expect(drawn.seedHash).toBe(published);
  expect(sha256(drawn.seed)).toBe(published);
  const winners = drawn.winners.map((w: { participant: string }) => w.participant);
  expect(winners).toHaveLength(2);
  expect(new Set(winners).size).toBe(2);
  expect(recompute(drawn.seed, people, 2)).toEqual(winners);
  await page.goto(`/#/draws/${created.id}`);
  await expect(page.getByTestId('fairness')).toContainText('Все совпало');
});
