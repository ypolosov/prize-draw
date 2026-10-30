import type { Winner } from './api';

export function prizeView(winner: Winner) {
  if (winner.status === 'confirmed') return { text: 'Подтверждён', tone: 'ok', canRedraw: false };
  if (winner.status === 'unclaimed') return { text: 'Не подтверждён в срок', tone: 'bad', canRedraw: true };
  return { text: 'Ждёт подтверждения', tone: 'wait', canRedraw: false };
}
