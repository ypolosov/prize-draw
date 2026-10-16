import { expect, test } from '@playwright/test';

const uniq = () => Math.random().toString(16).slice(2, 8);

// Сдвиг часов стенда демо нужен, чтобы срок подтверждения (3 дня) истёк; без него - пропуск.
const setDays = (request: import('@playwright/test').APIRequestContext, days: number) =>
  request.post('/api/demo/clock', { data: { days } });

async function drawnWith(request: import('@playwright/test').APIRequestContext, people: string[], prizes = 1) {
  const created = await (await request.post('/api/draws', { data: { title: `e2e redraw ${uniq()}`, prizes } })).json();
  for (const p of people)
    await request.post(`/api/draws/${created.id}/entries`, { data: { participant: p, birthDate: '1990-05-05' } });
  await request.post(`/api/draws/${created.id}/close`);
  return (await (await request.post(`/api/draws/${created.id}/draw`)).json()) as {
    id: number;
    winners: { participant: string }[];
  };
}

test.describe('повторный розыгрыш приза', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ request }) => {
    const r = await request.get('/api/demo/clock');
    test.skip(r.status() !== 200, 'часы стенда демо выключены (DEMO_CLOCK=off)');
    await setDays(request, 0);
  });
  test.afterEach(async ({ request }) => {
    await setDays(request, 0);
  });

  test('кнопки нет, пока срок подтверждения не истёк', async ({ page, request }) => {
    const d = await drawnWith(request, ['анна', 'борис', 'вера']);
    await page.goto(`/#/draws/${d.id}`);
    await expect(page.getByRole('button', { name: 'Подтвердить' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
  });

  test('кнопки нет у подтверждённого приза', async ({ page, request }) => {
    const d = await drawnWith(request, ['анна', 'борис', 'вера']);
    await request.post(`/api/draws/${d.id}/winners/1/confirm`, { data: { participant: d.winners[0]?.participant } });
    await setDays(request, 4);
    await page.goto(`/#/draws/${d.id}`);
    await expect(page.getByText('приз подтверждён')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
  });

  test('невостребованный приз: кнопка активна, показан новый победитель', async ({ page, request }) => {
    const d = await drawnWith(request, ['анна', 'борис', 'вера']);
    const first = d.winners[0]?.participant ?? '';
    await setDays(request, 4);
    await page.goto(`/#/draws/${d.id}`);
    const button = page.getByRole('button', { name: 'Разыграть заново' });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByRole('alert')).toContainText('новый победитель');
    await expect(page.getByTestId('unclaimed-1')).toContainText(first);
    const after = await (await request.get(`/api/draws/${d.id}`)).json();
    const next = after.winners[0].participant;
    expect(next).not.toBe(first);
    await expect(page.getByRole('listitem').filter({ hasText: next })).toContainText(`подтвердить до`);
    await expect(page.getByTestId('fairness')).toHaveText('результат честный: зерно и победители сходятся');
  });

  test('нет кандидатов: ошибка понятным текстом, приз прежний', async ({ page, request }) => {
    const d = await drawnWith(request, ['анна']);
    const first = d.winners[0]?.participant ?? '';
    await setDays(request, 4);
    await page.goto(`/#/draws/${d.id}`);
    await page.getByRole('button', { name: 'Разыграть заново' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('не осталось участников');
    await expect(alert).not.toContainText('R5');
    await expect(page.getByRole('listitem').filter({ hasText: first })).toContainText('не востребован');
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toBeEnabled();
  });
});
