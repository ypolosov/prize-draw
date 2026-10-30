import { expect, test } from '@playwright/test';
import { recompute, sha256 } from './verify';

test('невостребованный приз, повтор и независимая проверка', async ({ page }) => {
  const seed = 'redraw-test';
  const participants = ['Анна', 'Борис', 'Вера', 'Глеб'];
  const selected = recompute(seed, participants, 3);
  const history = selected.map((participant, i) => ({
    position: i < 2 ? i + 1 : 2,
    selection: i + 1,
    participant,
    status: i === 0 ? 'confirmed' : i === 1 ? 'unclaimed' : 'pending',
    confirmBy: '2026-11-02T00:00:00Z',
  }));
  let repeated = false;
  await page.route('**/api/draws/144**', async (route) => {
    if (route.request().method() === 'POST') repeated = true;
    await route.fulfill({
      json: {
        id: 144,
        title: 'Весенний розыгрыш',
        prizes: 2,
        entries: 4,
        opensAt: '2026-10-01T00:00:00Z',
        closesAt: '2026-10-15T00:00:00Z',
        drawnAt: '2026-10-15T00:00:00Z',
        seed,
        seedHash: sha256(seed),
        participants,
        selectionHistory: history.slice(0, repeated ? 3 : 2),
        winners: [history[0], history[repeated ? 2 : 1]],
      },
    });
  });
  await page.goto('/#/draws/144');
  await expect(page.getByRole('heading', { name: 'Приз ждёт нового победителя' })).toBeVisible();
  await page.getByRole('button', { name: 'Разыграть заново' }).first().click();
  await expect(page.getByRole('heading', { name: `У приза новый победитель — ${selected[2]}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разыграть заново' })).toHaveCount(0);
  await expect(page.getByTestId('fairness')).toContainText('Все совпало');
});

test('при отсутствии кандидатов показывает ошибку и сохраняет победителя', async ({ page }) => {
  await page.route('**/api/draws/144**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 409, json: { message: 'кандидатов для повтора не осталось' } });
      return;
    }
    await route.fulfill({
      json: {
        id: 144,
        title: 'Розыгрыш',
        prizes: 1,
        entries: 1,
        opensAt: '2026-10-01',
        closesAt: '2026-10-15',
        drawnAt: '2026-10-15',
        seed: 'seed',
        seedHash: sha256('seed'),
        participants: ['Анна'],
        winners: [{ position: 1, selection: 1, participant: 'Анна', status: 'unclaimed', confirmBy: '2026-10-18' }],
      },
    });
  });
  await page.goto('/#/draws/144');
  await page.getByRole('button', { name: 'Разыграть заново' }).first().click();
  await expect(page.getByRole('alert')).toContainText('Победитель приза не изменился');
  await expect(page.getByText('Победитель: Анна')).toBeVisible();
});

test('подменённый повтор не проходит проверку, доступна повторная проверка', async ({ page }) => {
  const seed = 'redraw-test';
  const participants = ['Анна', 'Борис', 'Вера'];
  const selected = recompute(seed, participants, 2);
  const original = {
    position: 1,
    selection: 1,
    participant: selected[0],
    status: 'unclaimed',
    confirmBy: '2026-10-18',
  };
  const replacement = { ...original, selection: 2, participant: selected[0], status: 'pending' };
  await page.route('**/api/draws/144', (route) =>
    route.fulfill({
      json: {
        id: 144,
        title: 'Розыгрыш',
        prizes: 1,
        entries: 3,
        opensAt: '2026-10-01',
        closesAt: '2026-10-15',
        drawnAt: '2026-10-15',
        seed,
        seedHash: sha256(seed),
        participants,
        winners: [replacement],
        selectionHistory: [original, replacement],
      },
    }),
  );
  await page.goto('/#/draws/144');
  await expect(page.getByTestId('fairness')).toContainText('Результаты не совпали');
  await page.getByRole('button', { name: 'Повторить проверку' }).click();
  await expect(page.getByTestId('fairness')).toContainText('Не доверяйте этому итогу');
});
