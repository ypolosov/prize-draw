// Повтор розыгрыша приза: когда кнопка доступна и что сказать организатору.
import type { Draw, Winner } from './api';

// Кнопка нужна только у приза, который не подтверждён за отведённый срок.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

// Сообщение после успешного повтора: кто теперь победитель этого приза.
export function redrawMessage(draw: Draw, position: number): string {
  const winner = draw.winners.find((w) => w.position === position);
  return winner ? `приз ${position}: новый победитель - ${winner.participant}` : 'приз разыгран заново';
}

export interface RedrawOutcome {
  // Новое состояние розыгрыша; при ошибке его нет, и экран остаётся прежним.
  draw?: Draw;
  message: string;
}

// Повтор приза: просит API разыграть заново и готовит текст для организатора.
export async function runRedraw(
  redraw: (id: number, position: number) => Promise<Draw>,
  id: number,
  position: number,
  errorText: (e: unknown) => string,
): Promise<RedrawOutcome> {
  try {
    const draw = await redraw(id, position);
    return { draw, message: redrawMessage(draw, position) };
  } catch (e) {
    return { message: `Не удалось разыграть заново: ${errorText(e)}` };
  }
}
