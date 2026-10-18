// Повтор невостребованного приза: что показать на экране. Сам повтор выполняет API (ADR-3).
import type { Winner } from './api';

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
