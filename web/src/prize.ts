// Экран приза: что показать и какие кнопки доступны (чистые функции, без DOM).
import type { Draw, Winner } from './api';

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

export interface RedrawOutcome {
  draw?: Draw;
  message: string;
}

// Повтор приза: новый победитель берётся из ответа API; при ошибке экран остаётся прежним.
export async function runRedraw(
  redraw: () => Promise<Draw>,
  errorReason: (e: unknown) => string,
): Promise<RedrawOutcome> {
  try {
    const draw = await redraw();
    return { draw, message: 'Приз разыгран заново: на экране новый победитель.' };
  } catch (e) {
    return { message: redrawErrorText(errorReason(e)) };
  }
}
