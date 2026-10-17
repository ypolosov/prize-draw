import { describe, expect, it } from 'vitest';
import type { Winner } from '../src/api';
import { canConfirm, canRedraw, redrawErrorText, winnerStatusText } from '../src/winners';

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
