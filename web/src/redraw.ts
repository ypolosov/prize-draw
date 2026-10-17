// Повтор розыгрыша приза: когда кнопка доступна и что сказать организатору.
import type { Draw, Winner } from './api';

// Кнопка нужна только у приза, который не подтверждён за отведённый срок.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';

// Сообщение после успешного повтора: кто теперь победитель этого приза.
export function redrawMessage(draw: Draw, position: number): string {
  const winner = draw.winners.find((w) => w.position === position);
  return winner ? `приз ${position}: новый победитель - ${winner.participant}` : 'приз разыгран заново';
}
