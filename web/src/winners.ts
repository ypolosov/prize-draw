// Что показать у победителя на экране организатора: подпись статуса и доступные кнопки.
import type { Winner } from './api';

export const winnerStatusText = (w: Winner, fmt: (iso: string) => string): string =>
  w.status === 'confirmed'
    ? 'приз подтверждён'
    : w.status === 'unclaimed'
      ? 'не востребован'
      : `подтвердить до ${fmt(w.confirmBy)}`;

export const canConfirm = (w: Winner): boolean => w.status === 'pending';

// Разыграть заново можно только приз, который не подтверждён за отведённые 3 дня.
export const canRedraw = (w: Winner): boolean => w.status === 'unclaimed';

export const redrawErrorText = (reason: string): string =>
  `Не удалось разыграть приз заново: ${reason}. Прежний победитель остаётся без изменений.`;

export interface RedrawResult<D> {
  draw?: D;
  message: string;
}

// Повтор розыгрыша приза: при успехе отдаёт обновлённый розыгрыш из ответа API, при ошибке - только
// сообщение, чтобы экран оставил прежнего победителя.
export async function runRedraw<D>(
  call: () => Promise<D>,
  errorText: (e: unknown) => string,
): Promise<RedrawResult<D>> {
  try {
    return { draw: await call(), message: 'приз разыгран заново' };
  } catch (e) {
    return { message: redrawErrorText(errorText(e)) };
  }
}
