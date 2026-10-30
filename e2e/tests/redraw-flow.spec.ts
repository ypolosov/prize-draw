import { expect, test } from '@playwright/test';
import { recompute, sha256 } from './verify';

// Нужен отдельный стенд с DEMO_CLOCK=on: часы общие для всего API.
// Запускать отдельно от остальных файлов: npm exec -w e2e -- playwright test redraw-flow.spec.ts --workers=1.
test('DRAW-145: невостребованный приз разыгрывается повторно, итог сохраняется и сходится с зерном', async ({
  page,
  request,
}) => {
  const clockResponse = await request.get('/api/demo/clock');
  expect(clockResponse.ok(), 'Для проверки нужен стенд с DEMO_CLOCK=on').toBeTruthy();
  const clock: { days: number } = await clockResponse.json();
  expect(clock.days, 'Для сдвига на три дня должен оставаться запас демо-часов').toBeLessThanOrEqual(27);

  try {
    const title = `DRAW-145 ${Date.now()}`;
    const participants = ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина'];
    await page.goto('/#/');
    await page.getByLabel('Название', { exact: true }).fill(title);
    await page.getByLabel('Призов', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Создать', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const publishedHash = await page.getByTestId('seed-hash').innerText();

    for (const participant of participants) {
      await page.getByLabel('Участник', { exact: true }).fill(participant);
      await page.getByLabel('Дата рождения').fill('1990-05-05');
      await page.getByRole('button', { name: 'Подать заявку', exact: true }).click();
      await expect(
        page.getByText(`Призов: 2. Заявок: ${participants.indexOf(participant) + 1}.`, { exact: false }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: 'Закончить приём заявок', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Подать заявку', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Выбрать победителей', exact: true }).click();
    await expect(page.getByTestId('fairness')).toContainText('Все совпало');

    const seed = await page.getByTestId('seed').innerText();
    expect(sha256(seed)).toBe(publishedHash);
    const selected = recompute(seed, participants, 3);
    const firstPrize = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Приз за место 1', exact: true }) });
    const secondPrize = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Приз за место 2', exact: true }) });
    await expect(firstPrize.getByText(`Победитель: ${selected[0]}`, { exact: true })).toBeVisible();
    await expect(secondPrize.getByText(`Победитель: ${selected[1]}`, { exact: true })).toBeVisible();
    await firstPrize.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await expect(firstPrize.getByText('Подтверждён', { exact: true })).toBeVisible();
    await expect(secondPrize.getByRole('button', { name: 'Подтвердить', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Разыграть заново', exact: true })).toHaveCount(0);

    expect((await request.post('/api/demo/clock', { data: { days: clock.days + 3 } })).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Приз ждёт нового победителя', exact: true })).toBeVisible();
    await expect(firstPrize.getByRole('button', { name: 'Разыграть заново', exact: true })).toHaveCount(0);
    await secondPrize.getByRole('button', { name: 'Разыграть заново', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: `У приза новый победитель — ${selected[2]}`, exact: true }),
    ).toBeVisible();

    // Перезагрузка проверяет сохранённый итог, а не только состояние после нажатия кнопки.
    await page.reload();
    await expect(firstPrize.getByText(`Победитель: ${selected[0]}`, { exact: true })).toBeVisible();
    await expect(secondPrize.getByText(`Победитель: ${selected[2]}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(firstPrize.getByText('Подтверждён', { exact: true })).toBeVisible();
    await expect(secondPrize.getByText('Ждёт подтверждения', { exact: true })).toBeVisible();
    await expect(page.getByRole('article').getByText(`Победитель: ${selected[1]}`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('article').getByText(`Победитель: ${selected[0]}`, { exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Разыграть заново', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('fairness')).toContainText('Все совпало');
    await expect(page.getByTestId('seed')).toHaveText(seed);
  } finally {
    expect((await request.post('/api/demo/clock', { data: { days: clock.days } })).ok()).toBeTruthy();
  }
});
