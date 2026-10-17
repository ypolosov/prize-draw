// Что показать у приза организатору: кнопку «Разыграть заново» видно только у невостребованного приза.
import { ApiError, type Draw, type Winner } from './api';

export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

export interface RedrawOutcome {
  draw: Draw;
  message: string;
}

// Повторный розыгрыш приза: при успехе экран получает розыгрыш с новым победителем,
// при отказе API - прежний розыгрыш и текст ошибки.
export async function redrawPrize(
  redraw: (id: number, position: number) => Promise<Draw>,
  current: Draw,
  position: number,
): Promise<RedrawOutcome> {
  try {
    return { draw: await redraw(current.id, position), message: 'приз разыгран заново' };
  } catch (e) {
    return { draw: current, message: e instanceof ApiError ? e.message : 'API недоступен' };
  }
}
