// Повтор невостребованного приза: когда показывать кнопку и что сказать при отказе.
import type { Winner } from './api';

// Статус «не востребован» API считает по сроку подтверждения, поэтому кнопка нужна ровно ему.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

export const redrawFailure = (reason: string): string =>
  `Не удалось разыграть приз заново: ${reason}. Список победителей не изменился.`;
