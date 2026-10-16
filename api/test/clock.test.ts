import { afterEach, describe, expect, it } from 'vitest';
import { now, shiftDays, shiftedDays } from '../src/clock';

afterEach(() => {
  process.env.DEMO_CLOCK = 'on';
  shiftDays(0);
  delete process.env.DEMO_CLOCK;
});

describe('часы приложения', () => {
  it('без стенда демо время не сдвигается', () => {
    delete process.env.DEMO_CLOCK;
    expect(() => shiftDays(4)).toThrow('только на стенде демо');
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('на стенде демо сдвиг вперёд на дни - и обратно', () => {
    process.env.DEMO_CLOCK = 'on';
    shiftDays(4);
    expect(shiftedDays()).toBe(4);
    expect(Math.round((now().getTime() - Date.now()) / 86_400_000)).toBe(4);
    shiftDays(0);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('сдвиг - от 0 до 30 дней', () => {
    process.env.DEMO_CLOCK = 'on';
    expect(() => shiftDays(-1)).toThrow('от 0 до 30');
    expect(() => shiftDays(31)).toThrow('от 0 до 30');
  });
});
