import { expect, test } from '@playwright/test';

// Повтор приза после срока подтверждения (DRAW-50); часы стенда сдвигаются запросом демо.
test('невостребованному призу доступно «Разыграть заново», подтверждённому - нет', async ({ page, request }) => {
  const clock = await request.post('/api/demo/clock', { data: { days: 0 } });
  test.skip(!clock.ok(), 'часы демо выключены (DEMO_CLOCK=on)');
  const draw = await (await request.post('/api/draws', { data: { title: `e2e redraw ${Date.now()}`, prizes: 2 } })).json();
  for (const p of ['вера', 'анна', 'глеб', 'борис', 'дина']) {
    await request.post(`/api/draws/${draw.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } });
  }
  await request.post(`/api/draws/${draw.id}/close`);
  const drawn = await (await request.post(`/api/draws/${draw.id}/draw`)).json();
  const first = drawn.winners[0];
  await request.post(`/api/draws/${draw.id}/winners/1/confirm`, { data: { participant: first.participant } });
  try {
    await request.post('/api/demo/clock', { data: { days: 4 } });
    await page.goto(`/#/draws/${draw.id}`);
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Разыграть заново' }).click();
    await expect(page.getByRole('alert')).toContainText('Новый победитель приза');
  } finally {
    await request.post('/api/demo/clock', { data: { days: 0 } });
  }
});
