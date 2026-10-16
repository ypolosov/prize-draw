// Часы приложения: текущее время предметной области в api/src - только now(), не new Date() и не
// Date.now(). На стенде демо (DEMO_CLOCK=on) время можно сдвинуть вперёд запросом
// POST /api/demo/clock {"days": N} - так видно, что бывает после срока подтверждения приза (R6),
// не дожидаясь трёх дней. В остальных окружениях сдвиг недоступен.
let shiftMs = 0;

export const demoClock = (): boolean => process.env.DEMO_CLOCK === 'on';

export const now = (): Date => new Date(Date.now() + shiftMs);

export function shiftDays(days: number): void {
  if (!demoClock()) throw new Error('часы сдвигаются только на стенде демо (DEMO_CLOCK=on)');
  if (!Number.isFinite(days) || days < 0 || days > 30) throw new RangeError('days: от 0 до 30');
  shiftMs = days * 24 * 60 * 60 * 1000;
}

export const shiftedDays = (): number => shiftMs / (24 * 60 * 60 * 1000);
