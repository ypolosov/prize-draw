import { expect, type Page, test } from '@playwright/test';

// Экран организатора проверяется на подменённых ответах API: сам повтор проверяет его владелец.
const winner = (position: number, participant: string, status: string) => ({
  position,
  participant,
  status,
  confirmBy: '2026-01-04T00:00:00.000Z',
});
const drawWith = (winners: unknown[]) => ({
  id: 9001,
  title: 'e2e повтор',
  prizes: winners.length,
  opensAt: '2026-01-01T00:00:00.000Z',
  closesAt: '2026-01-02T00:00:00.000Z',
  seedHash: 'h',
  entries: 3,
  seed: 's',
  drawnAt: '2026-01-02T00:00:00.000Z',
  participants: [],
  winners,
});

async function open(page: Page, draw: unknown) {
  await page.route('**/api/draws/9001', (r) => r.fulfill({ json: draw }));
  await page.goto('/#/draws/9001');
}

test('кнопка только у невостребованного приза', async ({ page }) => {
  await open(page, drawWith([winner(1, 'анна', 'unclaimed'), winner(2, 'борис', 'pending')]));
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(1);
  await expect(page.getByRole('listitem').filter({ hasText: 'анна' }).getByRole('button')).toHaveText(
    'Разыграть заново',
  );
});

test('успешный повтор показывает нового победителя', async ({ page }) => {
  await open(page, drawWith([winner(1, 'анна', 'unclaimed')]));
  await page.route('**/api/draws/9001/winners/1/redraw', (r) =>
    r.fulfill({ json: drawWith([winner(1, 'вера', 'pending')]) }),
  );
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'вера' })).toBeVisible();
  await expect(page.getByText('анна')).toHaveCount(0);
});

test('ошибка повтора: сообщение, прежние данные на месте', async ({ page }) => {
  await open(page, drawWith([winner(1, 'анна', 'unclaimed')]));
  await page.route('**/api/draws/9001/winners/1/redraw', (r) =>
    r.fulfill({ status: 409, json: { message: 'нет кандидатов' } }),
  );
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось разыграть приз заново');
  await expect(page.getByRole('listitem').filter({ hasText: 'анна' })).toBeVisible();
});
