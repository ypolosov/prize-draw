// Повтор невостребованного приза: что показать организатору на экране приза.
import type { Winner } from './api';

// Кнопка «Разыграть заново» нужна только призу, который не подтвердили за 3 дня.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

// Коды правил и решений - для разработчиков, организатору они ничего не говорят.
const stripCodes = (reason: string): string =>
  reason
    .replace(/\b(?:R\d+|ADR-\d+)\b:?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function redrawErrorText(reason: string): string {
  const why = stripCodes(reason);
  return `Не удалось разыграть приз заново${why ? `: ${why}` : ''}. Приз остался у прежнего победителя - можно попробовать позже.`;
}

// Ответ не получен: повтор мог выполниться, поэтому нельзя уверять, что приз остался прежним.
export const redrawUnknownText = (): string =>
  'Не удалось получить ответ сервера, поэтому неизвестно, разыгран ли приз заново. Обновите страницу и проверьте победителя.';
