// Что показать у приза организатору: кнопку «Разыграть заново» видно только у невостребованного приза.
import type { Winner } from './api';

export const canRedraw = (w: Pick<Winner, 'status'>): boolean => w.status === 'unclaimed';
