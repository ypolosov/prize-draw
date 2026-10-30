import type { Draw, Winner } from './api';

export function prizeView(winner: Winner) {
  if (winner.status === 'confirmed') return { text: 'Подтверждён', tone: 'ok', canRedraw: false };
  if (winner.status === 'unclaimed') return { text: 'Не подтверждён в срок', tone: 'bad', canRedraw: true };
  return { text: 'Ждёт подтверждения', tone: 'wait', canRedraw: false };
}

export async function redrawPrize(
  draw: Draw,
  position: number,
  request: (id: number, position: number) => Promise<Draw>,
): Promise<Draw> {
  const winner = draw.winners.find((item) => item.position === position);
  if (!winner || !prizeView(winner).canRedraw) {
    throw new Error('Повтор доступен только для невостребованного приза.');
  }
  return request(draw.id, position);
}
