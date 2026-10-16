// Проверка честности на экране: исходный выбор и повтор приза принимаются, подмена - нет.
import { describe, expect, it } from 'vitest';
import { winnersMatch } from '../src/verify';

const sequence = ['анна', 'борис', 'вера', 'глеб'];

describe('winnersMatch', () => {
  it('принимает исходный выбор', () => {
    expect(winnersMatch(sequence, 2, [{ position: 1, participant: 'анна' }, { position: 2, participant: 'борис' }])).toBe(true);
  });
  it('принимает повтор: победитель - следующий кандидат', () => {
    expect(winnersMatch(sequence, 2, [{ position: 1, participant: 'анна' }, { position: 2, participant: 'вера' }])).toBe(true);
  });
  it('отвергает подмену победителя на позиции исходного выбора', () => {
    expect(winnersMatch(sequence, 2, [{ position: 1, participant: 'борис' }, { position: 2, participant: 'анна' }])).toBe(false);
  });
  it('отвергает дубль и чужого участника', () => {
    expect(winnersMatch(sequence, 2, [{ position: 1, participant: 'анна' }, { position: 2, participant: 'анна' }])).toBe(false);
    expect(winnersMatch(sequence, 1, [{ position: 1, participant: 'пётр' }])).toBe(false);
  });
});
