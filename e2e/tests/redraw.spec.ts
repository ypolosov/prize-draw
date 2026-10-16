// Кнопка «Разыграть заново» на экране приза. API повтора подменён: срок подтверждения в 3 дня
// нельзя выдержать в сквозной проверке.
import { expect, type Page, test } from '@playwright/test';

type Status = 'pending' | 'confirmed' | 'unclaimed';

const draw = (status: Status, participant = 'анна') => ({
  id: 7,
  title: 'e2e повтор',
  prizes: 1,
  opensAt: '2026-01-01T00:00:00Z',
  closesAt: '2026-01-02T00:00:00Z',
  seedHash: 'h',
  entries: 3,
  drawnAt: '2026-01-02T00:00:00Z',
  winners: [{ position: 1, participant, status, confirmBy: '2026-01-05T00:00:00Z' }],
});

async function open(page: Page, status: Status) {
  await page.route('**/api/draws/7', (r) => r.fulfill({ json: draw(status) }));
  await page.goto('/#/draws/7');
  await expect(page.getByRole('heading', { name: 'Победители' })).toBeVisible();
}

const button = (page: Page) => page.getByRole('button', { name: 'Разыграть заново' });

test('кнопка доступна, если приз не подтверждён за 3 дня', async ({ page }) => {
  await open(page, 'unclaimed');
  await expect(button(page)).toBeEnabled();
});

for (const status of ['confirmed', 'pending'] as const) {
  test(`кнопки нет, если приз ${status === 'confirmed' ? 'подтверждён' : 'ещё можно подтвердить'}`, async ({
    page,
  }) => {
    await open(page, status);
    await expect(button(page)).toHaveCount(0);
  });
}

test('после повтора на экране новый победитель', async ({ page }) => {
  await open(page, 'unclaimed');
  await page.route('**/api/draws/7/winners/1/redraw', async (r) => {
    await page.unroute('**/api/draws/7');
    await page.route('**/api/draws/7', (g) => g.fulfill({ json: draw('pending', 'борис') }));
    await r.fulfill({ json: draw('pending', 'борис') });
  });
  await button(page).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'борис' })).toBeVisible();
  await expect(page.getByText('анна')).toHaveCount(0);
});

test('если участников не осталось, показана ошибка и победитель прежний', async ({ page }) => {
  await open(page, 'unclaimed');
  await page.route('**/api/draws/7/winners/1/redraw', (r) =>
    r.fulfill({ status: 409, json: { message: 'не осталось участников для повторного розыгрыша' } }),
  );
  await button(page).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось разыграть заново');
  await expect(page.getByRole('alert')).toContainText('не осталось участников');
  await expect(page.getByRole('listitem').filter({ hasText: 'анна' })).toBeVisible();
});
