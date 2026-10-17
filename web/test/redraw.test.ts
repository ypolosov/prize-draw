import { describe, expect, it } from 'vitest';
import { canRedraw, redrawFailure, runRedraw } from '../src/redraw';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'API недоступен');

describe('повтор невостребованного приза', () => {
  it('кнопка доступна, когда приз не подтверждён за 3 дня', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });

  it('кнопки нет, пока срок не прошёл или приз подтверждён', () => {
    expect(canRedraw({ status: 'pending' })).toBe(false);
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
  });

  it('сообщение об отказе называет причину и говорит, что победители прежние', () => {
    const text = redrawFailure('кандидатов не осталось');
    expect(text).toContain('кандидатов не осталось');
    expect(text).toContain('не изменился');
  });

  it('нажатие вызывает повтор и отдаёт розыгрыш с новым победителем', async () => {
    let calls = 0;
    const fresh = { winners: [{ participant: 'Новый' }] };
    const r = await runRedraw(async () => {
      calls++;
      return fresh;
    }, errorText);
    expect(calls).toBe(1);
    expect(r).toMatchObject({ ok: true, draw: fresh });
    expect(r.message).toContain('новый победитель');
  });

  it('при отказе API нет нового розыгрыша, а сообщение объясняет причину', async () => {
    const r = await runRedraw(async () => {
      throw new Error('кандидатов не осталось');
    }, errorText);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty('draw');
    expect(r.message).toContain('кандидатов не осталось');
    expect(r.message).toContain('не изменился');
  });
});
