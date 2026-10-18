// Повтор розыгрыша невостребованного приза: что показать организатору.
import type { Winner } from './api';

export const REDRAW_FAILED =
  'Не удалось разыграть приз заново. Проверьте, что остались кандидаты, и попробуйте ещё раз.';

// Кнопка «Разыграть заново» нужна, только если победитель не подтвердил приз в срок.
export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';
