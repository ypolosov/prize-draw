import { expect, test } from '@playwright/test';

const uniq = () => Math.random().toString(16).slice(2, 8);

test('одна заявка на участника (R1): повторная заявка отклоняется', async ({ page, request }) => {
  const draw = await (await request.post('/api/draws', { data: { title: `e2e R1 ${uniq()}`, prizes: 1 } })).json();
  await page.goto(`/#/draws/${draw.id}`);
  const who = `участник-${uniq()}`;
  await page.getByLabel('Участник').fill(who);
  await page.getByLabel('Дата рождения').fill('2000-01-01');
  await page.getByRole('button', { name: 'Подать заявку' }).click();
  await expect(page.getByRole('alert')).toHaveText('заявка принята');
  await page.getByRole('button', { name: 'Подать заявку' }).click();
  await expect(page.getByRole('alert')).toContainText('R1');
  const again = await request.post(`/api/draws/${draw.id}/entries`, {
    data: { participant: who, birthDate: '2000-01-01' },
  });
  expect(again.status()).toBe(409);
  expect((await (await request.get(`/api/draws/${draw.id}`)).json()).entries).toBe(1);
});

test('несовершеннолетнему заявка не принимается (R3)', async ({ request }) => {
  const draw = await (await request.post('/api/draws', { data: { title: `e2e R3 ${uniq()}` } })).json();
  const r = await request.post(`/api/draws/${draw.id}/entries`, {
    data: { participant: 'teen', birthDate: '2015-01-01' },
  });
  expect(r.status()).toBe(422);
  expect((await r.json()).rule).toBe('R3');
});
