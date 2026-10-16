// Экран организатора: кнопка «Разыграть заново» у невостребованного приза. Ответы API
// подставлены, чтобы не ждать 3 дня подтверждения.
import { expect, test } from '@playwright/test';

type Status = 'pending' | 'confirmed' | 'unclaimed';

const drawWith = (status: Status, participant = 'анна') => ({
  id: 7,
  title: 'e2e повтор приза',
  prizes: 1,
  opensAt: '2026-01-01T00:00:00.000Z',
  closesAt: '2026-01-02T00:00:00.000Z',
  seedHash: 'abc',
  entries: 3,
  seed: 'seed',
  drawnAt: '2026-01-02T00:00:00.000Z',
  participants: ['анна', 'борис', 'вера'],
  winners: [{ position: 1, participant, status, confirmBy: '2026-01-05T00:00:00.000Z' }],
});

test('кнопка есть у невостребованного приза', async ({ page }) => {
  await page.route('**/api/draws/7', (route) => route.fulfill({ json: drawWith('unclaimed') }));
  await page.goto('/#/draws/7');
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toBeEnabled();
});

for (const status of ['pending', 'confirmed'] as const) {
  test(`кнопки нет, пока приз ${status === 'pending' ? 'ждёт подтверждения' : 'подтверждён'}`, async ({ page }) => {
    await page.route('**/api/draws/7', (route) => route.fulfill({ json: drawWith(status) }));
    await page.goto('/#/draws/7');
    await expect(page.getByRole('heading', { name: 'Победители' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
  });
}

test('после повтора у приза новый победитель', async ({ page }) => {
  let redrawn = false;
  await page.route('**/api/draws/7', (route) =>
    route.fulfill({ json: redrawn ? drawWith('pending', 'борис') : drawWith('unclaimed') }),
  );
  await page.route('**/api/draws/7/winners/1/redraw', (route) => {
    redrawn = true;
    return route.fulfill({ status: 200, json: drawWith('pending', 'борис') });
  });
  await page.goto('/#/draws/7');
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'борис' })).toBeVisible();
  await expect(page.getByText('анна')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
});

test('при ошибке повтора видно сообщение, победитель прежний', async ({ page }) => {
  await page.route('**/api/draws/7', (route) => route.fulfill({ json: drawWith('unclaimed') }));
  await page.route('**/api/draws/7/winners/1/redraw', (route) =>
    route.fulfill({ status: 409, json: { message: 'нет оставшихся кандидатов' } }),
  );
  await page.goto('/#/draws/7');
  await page.getByRole('button', { name: 'Разыграть заново' }).click();
  await expect(page.getByRole('alert')).toContainText('нет оставшихся кандидатов');
  await expect(page.getByRole('listitem').filter({ hasText: 'анна' })).toBeVisible();
});
