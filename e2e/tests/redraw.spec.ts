import { expect, test } from '@playwright/test';

const uniq = () => Math.random().toString(16).slice(2, 8);
const people = ['вера', 'анна', 'глеб', 'борис'];

async function drawnWithOneWinner(request: import('@playwright/test').APIRequestContext) {
  const draw = await (await request.post('/api/draws', { data: { title: `e2e redraw ${uniq()}`, prizes: 1 } })).json();
  for (const p of people) {
    await request.post(`/api/draws/${draw.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } });
  }
  await request.post(`/api/draws/${draw.id}/close`);
  return (await (await request.post(`/api/draws/${draw.id}/draw`)).json()) as {
    id: number;
    winners: { participant: string }[];
  };
}

test('кнопки «Разыграть заново» нет, пока срок подтверждения не истёк', async ({ page, request }) => {
  const drawn = await drawnWithOneWinner(request);
  await page.goto(`/#/draws/${drawn.id}`);
  await expect(page.getByRole('button', { name: 'Подтвердить' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
});

test('невостребованный приз можно разыграть заново: на экране новый победитель', async ({ page, request }) => {
  const clock = await request.post('/api/demo/clock', { data: { days: 4 } });
  test.skip(!clock.ok(), 'часы демо выключены (DEMO_CLOCK=off)');
  try {
    const drawn = await drawnWithOneWinner(request);
    const before = drawn.winners[0]?.participant ?? '';
    await page.goto(`/#/draws/${drawn.id}`);
    await expect(page.getByText('не востребован')).toBeVisible();
    await page.getByRole('button', { name: 'Разыграть заново' }).click();
    await expect(page.getByRole('alert')).toContainText('разыгран заново');
    const list = page.getByRole('listitem').filter({ hasText: 'подтвердить до' });
    await expect(list).toBeVisible();
    await expect(list).not.toContainText(before);
  } finally {
    await request.post('/api/demo/clock', { data: { days: 0 } });
  }
});
