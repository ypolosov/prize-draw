import { expect, test } from '@playwright/test';

const uniq = () => Math.random().toString(16).slice(2, 8);

async function drawnPrize(request: import('@playwright/test').APIRequestContext, people: string[]) {
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

test.describe('повтор невостребованного приза', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ request }) => {
    await request.post('/api/demo/clock', { data: { days: 0 } });
  });

  test('срок не истёк - кнопки нет; через 3 дня - есть, и новый победитель на экране', async ({ page, request }) => {
    const clock = await request.post('/api/demo/clock', { data: { days: 0 } });
    expect(clock.ok(), 'часы демо выключены: для e2e нужен DEMO_CLOCK').toBe(true);
    const people = [`а-${uniq()}`, `б-${uniq()}`, `в-${uniq()}`];
    const drawn = await drawnPrize(request, people);
    const first = drawn.winners[0].participant;

    await page.goto(`/#/draws/${drawn.id}`);
    await expect(page.getByRole('listitem').filter({ hasText: first })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);

    await request.post('/api/demo/clock', { data: { days: 4 } });
    await page.reload();
    await page.getByRole('button', { name: 'Разыграть заново' }).click();
    const item = page.getByRole('listitem').filter({ hasText: 'подтвердить до' });
    await expect(item).toBeVisible();
    await expect(item).not.toContainText(first);
  });

  test('приз подтверждён - кнопки нет', async ({ page, request }) => {
    const clock = await request.post('/api/demo/clock', { data: { days: 0 } });
    expect(clock.ok(), 'часы демо выключены: для e2e нужен DEMO_CLOCK').toBe(true);
    const drawn = await drawnPrize(request, [`а-${uniq()}`, `б-${uniq()}`]);
    await request.post(`/api/draws/${drawn.id}/winners/1/confirm`, {
      data: { participant: drawn.winners[0].participant },
    });
    await request.post('/api/demo/clock', { data: { days: 4 } });
    await page.goto(`/#/draws/${drawn.id}`);
    await expect(page.getByText('приз подтверждён')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
  });

  test('ошибка повтора - сообщение, прежний победитель остаётся', async ({ page, request }) => {
    const clock = await request.post('/api/demo/clock', { data: { days: 0 } });
    expect(clock.ok(), 'часы демо выключены: для e2e нужен DEMO_CLOCK').toBe(true);
    const drawn = await drawnPrize(request, [`а-${uniq()}`]);
    const first = drawn.winners[0].participant;
    await request.post('/api/demo/clock', { data: { days: 4 } });
    await page.goto(`/#/draws/${drawn.id}`);
    await page.getByRole('button', { name: 'Разыграть заново' }).click();
    await expect(page.getByRole('alert')).toContainText('Не удалось разыграть заново');
    await expect(page.getByRole('listitem').filter({ hasText: first })).toBeVisible();
  });
});
