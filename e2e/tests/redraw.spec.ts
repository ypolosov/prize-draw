import { expect, test } from '@playwright/test';

// Часы стенда общие: тесты повтора идут по очереди и возвращают часы назад.
test.describe.configure({ mode: 'serial' });

const setClock = (request: import('@playwright/test').APIRequestContext, days: number) =>
  request.post('/api/demo/clock', { data: { days } });

async function drawnPrize(request: import('@playwright/test').APIRequestContext) {
  const draw = await (
    await request.post('/api/draws', { data: { title: `e2e повтор ${Date.now()}`, prizes: 1 } })
  ).json();
  for (const p of ['вера', 'анна', 'глеб']) {
    await request.post(`/api/draws/${draw.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } });
  }
  await request.post(`/api/draws/${draw.id}/close`);
  return (await (await request.post(`/api/draws/${draw.id}/draw`)).json()) as {
    id: number;
    winners: { participant: string }[];
  };
}

test.afterEach(async ({ request }) => {
  await setClock(request, 0);
});

test('кнопка «Разыграть заново» скрыта, пока 3 дня не прошли', async ({ page, request }) => {
  const draw = await drawnPrize(request);
  await page.goto(`/#/draws/${draw.id}`);
  await expect(page.getByRole('button', { name: 'Подтвердить' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
});

test('невостребованный приз разыгрывается заново: на экране новый победитель', async ({ page, request }) => {
  const draw = await drawnPrize(request);
  const before = draw.winners[0]?.participant;
  await setClock(request, 4);
  await page.goto(`/#/draws/${draw.id}`);
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toHaveText('Приз разыгран заново: на экране новый победитель.');
  const after = (await (await request.get(`/api/draws/${draw.id}`)).json()).winners.at(-1).participant;
  expect(after).not.toBe(before);
  await expect(page.getByRole('listitem').filter({ hasText: after })).toBeVisible();
});

test('отказ API: сообщение об ошибке, победители прежние', async ({ page, request }) => {
  const draw = await drawnPrize(request);
  await setClock(request, 4);
  await page.goto(`/#/draws/${draw.id}`);
  const list = page.getByRole('list').last();
  const before = await list.innerText();
  await page.route('**/api/draws/*/winners/*/redraw', (route) =>
    route.fulfill({ status: 409, json: { message: 'кандидатов не осталось' } }),
  );
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toContainText('кандидатов не осталось');
  expect(await list.innerText()).toBe(before);
});
