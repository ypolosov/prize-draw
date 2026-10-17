// Экран приза: что показать и какие кнопки доступны (чистые функции, без DOM).
import type { Winner } from './api';

// Повтор доступен только для невостребованного приза: срок подтверждения истёк, приз не подтверждён.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

// Сообщение об ошибке повтора: причина от API без кодов правил и что с призом.
export function redrawErrorText(reason: string): string {
  const clean = reason
    .replace(/\bR[1-6]\b[:,]?\s*/g, '')
    .replace(/\bADR-\d+\b[:,]?\s*/g, '')
    .trim();
  return `Не удалось разыграть заново${clean ? `: ${clean}` : ''}. Прежний победитель остался на месте.`;
}
