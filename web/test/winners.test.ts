import { describe, expect, it } from 'vitest';
import type { Winner } from '../src/api';
import { canConfirm, canRedraw, redrawErrorText, runRedraw, winnerStatusText } from '../src/winners';

const winner = (status: Winner['status']): Winner => ({
  position: 1,
  participant: 'анна',
  status,
  confirmBy: '2026-01-04T00:00:00.000Z',
});

describe('кнопка «Разыграть заново»', () => {
  it('доступна у приза, не подтверждённого за 3 дня', () => {
    expect(canRedraw(winner('unclaimed'))).toBe(true);
  });

  it('недоступна у подтверждённого приза и пока срок не истёк', () => {
    expect(canRedraw(winner('confirmed'))).toBe(false);
    expect(canRedraw(winner('pending'))).toBe(false);
  });

  it('кнопка подтверждения - только пока срок не истёк', () => {
    expect(canConfirm(winner('pending'))).toBe(true);
    expect(canConfirm(winner('unclaimed'))).toBe(false);
  });
});

describe('подписи победителя', () => {
  it('статус приза', () => {
    const fmt = (iso: string) => `<${iso}>`;
    expect(winnerStatusText(winner('confirmed'), fmt)).toBe('приз подтверждён');
    expect(winnerStatusText(winner('unclaimed'), fmt)).toBe('не востребован');
    expect(winnerStatusText(winner('pending'), fmt)).toBe('подтвердить до <2026-01-04T00:00:00.000Z>');
  });

  it('ошибка повтора говорит, что прежний победитель не изменился', () => {
    expect(redrawErrorText('нет оставшихся участников')).toContain('нет оставшихся участников');
    expect(redrawErrorText('x')).toContain('остаётся без изменений');
  });
});

describe('повтор розыгрыша приза', () => {
  const errorText = (e: unknown) => (e instanceof Error ? e.message : '?');

  it('при успехе отдаёт розыгрыш из ответа с новым победителем', async () => {
    const updated = { winners: [{ ...winner('pending'), participant: 'борис' }] };
    const result = await runRedraw(() => Promise.resolve(updated), errorText);
    expect(result.draw?.winners[0]?.participant).toBe('борис');
    expect(result.message).toBe('приз разыгран заново');
  });

  it('при ошибке API не отдаёт розыгрыш и объясняет причину', async () => {
    const result = await runRedraw(() => Promise.reject(new Error('нет оставшихся участников')), errorText);
    expect(result.draw).toBeUndefined();
    expect(result.message).toContain('нет оставшихся участников');
    expect(result.message).toContain('остаётся без изменений');
  });
});
