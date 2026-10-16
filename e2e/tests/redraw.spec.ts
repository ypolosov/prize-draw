import { expect, test } from '@playwright/test';

const shift = (request: import('@playwright/test').APIRequestContext, days: number) =>
  request.post('/api/demo/clock', { data: { days } });

// Часы стенда общие: проверки файла идут по очереди, после каждой часы возвращаются.
test.describe.configure({ mode: 'serial' });
test.afterEach(async ({ request }) => {
  await shift(request, 0);
});

async function drawn(request: import('@playwright/test').APIRequestContext, people: string[]) {
  const d = await (await request.post('/api/draws', { data: { title: `e2e повтор ${Date.now()}`, prizes: 1 } })).json();
  for (const p of people)
    await request.post(`/api/draws/${d.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } });
  await request.post(`/api/draws/${d.id}/close`);
  return (await (await request.post(`/api/draws/${d.id}/draw`)).json()) as {
    id: number;
    winners: { participant: string }[];
  };
}

test('кнопка «Разыграть заново» скрыта, пока срок подтверждения не истёк', async ({ page, request }) => {
  const d = await drawn(request, ['анна', 'борис', 'вера']);
  await page.goto(`/#/draws/${d.id}`);
  await expect(page.getByText('подтвердить до')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
});

test('после срока кнопка активна, повтор показывает нового победителя', async ({ page, request }) => {
  const d = await drawn(request, ['анна', 'борис', 'вера']);
  const before = d.winners[0]?.participant;
  await shift(request, 4);
  await page.goto(`/#/draws/${d.id}`);
  await expect(page.getByText('не востребован')).toBeVisible();
  const button = page.getByRole('button', { name: 'Разыграть заново' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole('alert')).toContainText('новый победитель выбран');
  const after = (await (await request.get(`/api/draws/${d.id}`)).json()).winners[0].participant;
  expect(after).not.toBe(before);
  await expect(page.getByRole('listitem').filter({ hasText: after })).toBeVisible();
});

test('ошибка повтора: сообщение и прежний победитель', async ({ page, request }) => {
  const d = await drawn(request, ['анна']);
  await shift(request, 4);
  await page.goto(`/#/draws/${d.id}`);
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toContainText('Победитель остался прежним');
  await expect(page.getByRole('listitem').filter({ hasText: 'анна' })).toBeVisible();
});

test('повтор удался, а последующая загрузка недоступна: новый победитель всё равно на экране', async ({
  page,
  request,
}) => {
  const d = await drawn(request, ['анна', 'борис', 'вера']);
  const before = d.winners[0]?.participant ?? '';
  await shift(request, 4);
  await page.goto(`/#/draws/${d.id}`);
  await expect(page.getByText('не востребован')).toBeVisible();
  await page.route(`**/api/draws/${d.id}`, (route) => route.abort());
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toContainText('новый победитель выбран');
  await expect(page.getByRole('listitem').filter({ hasText: before })).toHaveCount(0);
});
