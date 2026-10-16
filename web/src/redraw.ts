// Повтор невостребованного приза на экране организатора: когда показать кнопку и что сказать при отказе.
import { ApiError, type Winner } from './api';

export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

export function redrawErrorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Сервер недоступен. Попробуйте ещё раз позже.';
  if (e.status === 422) return 'Среди участников не осталось кандидатов. Приз остаётся невостребованным.';
  if (e.status === 409) return 'Разыграть заново нельзя: приз уже подтверждён или срок подтверждения ещё не истёк.';
  return 'Не удалось разыграть приз заново. Попробуйте ещё раз позже.';
}
