// Повтор невостребованного приза: что показать на экране. Сам повтор выполняет API (ADR-3).
import { ApiError, type Draw, type Winner } from './api';

export const NO_CANDIDATES =
  'Разыграть приз заново некому: в розыгрыше не осталось участников, которые ещё не выигрывали.';

// Кнопка нужна только призу, который не подтвердили в срок.
export const canRedraw = (w: Winner): boolean => w.status === 'unclaimed';

// Итог повтора по ответу API: новый победитель на том же месте или прежний.
export function redrawMessage(position: number, before: string, winners: Winner[]): string {
  const now = winners.find((w) => w.position === position)?.participant;
  if (!now || now === before) return `Победитель приза ${position} не изменился: ${before}`;
  return `У приза ${position} новый победитель - ${now}: у него есть 3 дня, чтобы подтвердить приз.`;
}

// Итог нажатия кнопки: что показать и какой розыгрыш взять на экран (при ошибке - прежний).
export interface RedrawOutcome {
  draw?: Draw;
  message: string;
  failed: boolean;
}

// 409 - API отказал в повторе (кандидатов не осталось); другие ошибки показываем как есть.
export async function runRedraw(
  call: (position: number) => Promise<Draw>,
  w: Winner,
  fallback: (e: unknown) => string,
): Promise<RedrawOutcome> {
  try {
    const next = await call(w.position);
    return { draw: next, message: redrawMessage(w.position, w.participant, next.winners), failed: false };
  } catch (e) {
    const noCandidates = e instanceof ApiError && e.status === 409;
    return { message: noCandidates ? NO_CANDIDATES : fallback(e), failed: true };
  }
}
