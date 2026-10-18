// Повтор невостребованного приза: что показать организатору и когда доступна кнопка.
import type { Winner } from './api';

// Кнопка «Разыграть заново» - только у приза, который победитель не подтвердил в срок.
export const canRedraw = (w: Winner): boolean => w.status === 'unclaimed';

export const unclaimedWinners = (winners: Winner[]): Winner[] => winners.filter(canRedraw);

export interface Redrawn {
  position: number;
  previous: string;
  current: Winner;
}

// Итог повтора: новый победитель места из ответа API; если победитель не сменился, повтор не прошёл.
export function redrawOutcome(before: Winner[], after: Winner[], position: number): Redrawn | undefined {
  const previous = before.find((w) => w.position === position);
  const current = after.find((w) => w.position === position);
  if (!previous || !current || previous.participant === current.participant) return undefined;
  return { position, previous: previous.participant, current };
}
