import { describe, expect, it } from 'vitest';
import type { Draw } from '../src/api';
import { canRedraw, redrawErrorText, runRedraw } from '../src/prize';

// Экран приза: кнопка «Разыграть заново» только для невостребованного приза.
describe('кнопка «Разыграть заново»', () => {
  it('доступна, если победитель не подтвердил приз в срок', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });
  it('скрыта, если приз подтверждён', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });
  it('скрыта, если срок подтверждения не истёк', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
});

describe('сообщение об ошибке повтора', () => {
  it('говорит, что победитель прежний, и не показывает коды правил', () => {
    const text = redrawErrorText('R5: нет кандидатов');
    expect(text).toContain('Прежний победитель');
    expect(text).toContain('нет кандидатов');
    expect(text).not.toMatch(/R\d/);
  });
  it('без причины даёт общий текст', () => {
    expect(redrawErrorText('')).toContain('Прежний победитель');
  });
});

describe('повтор приза', () => {
  const draw = { id: 1, winners: [{ position: 1, participant: 'новый', status: 'pending' }] } as unknown as Draw;
  it('при успехе возвращает новый розыгрыш из ответа API', async () => {
    const out = await runRedraw(
      async () => draw,
      () => '',
    );
    expect(out.draw?.winners[0].participant).toBe('новый');
    expect(out.message).toContain('новый победитель');
  });
  it('при ошибке не меняет экран и объясняет причину', async () => {
    const out = await runRedraw(
      async () => {
        throw new Error('x');
      },
      () => 'нет кандидатов',
    );
    expect(out.draw).toBeUndefined();
    expect(out.message).toContain('нет кандидатов');
    expect(out.message).toContain('Прежний победитель');
  });
});
