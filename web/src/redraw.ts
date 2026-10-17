// Повтор невостребованного приза: когда показывать кнопку и что сказать при отказе.
import type { Winner } from './api';

// Статус «не востребован» API считает по сроку подтверждения, поэтому кнопка нужна ровно ему.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

export const redrawFailure = (reason: string): string =>
  `Не удалось разыграть приз заново: ${reason}. Список победителей не изменился.`;

export type RedrawOutcome<D> = { ok: true; draw: D; message: string } | { ok: false; message: string };

// Повтор приза: при успехе - новый розыгрыш с победителем, при отказе - только сообщение.
export async function runRedraw<D>(
  redraw: () => Promise<D>,
  errorText: (e: unknown) => string,
): Promise<RedrawOutcome<D>> {
  try {
    return { ok: true, draw: await redraw(), message: 'Приз разыгран заново: на экране новый победитель.' };
  } catch (e) {
    return { ok: false, message: redrawFailure(errorText(e)) };
  }
}
