// Проверка честности на экране: исходный выбор принимается, повтор - только как частичная
// проверка, любая подмена отвергается.
import { describe, expect, it } from 'vitest';
import { checkWinners } from '../src/verify';

const sequence = ['анна', 'борис', 'вера', 'глеб', 'дина'];
const w = (position: number, participant: string) => ({ position, participant });

describe('checkWinners', () => {
  it('исходный выбор - точное совпадение', () => {
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(2, 'борис')])).toBe('exact');
  });
  it('повтор: победитель из продолжения - только частичная проверка', () => {
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(2, 'вера')])).toBe('partial');
  });
  it('подмена победителя на позиции исходного выбора отвергается', () => {
    expect(checkWinners(sequence, 2, [w(1, 'борис'), w(2, 'анна')])).toBe('mismatch');
  });
  it('пустой и неполный список отвергаются', () => {
    expect(checkWinners(sequence, 2, [])).toBe('mismatch');
    expect(checkWinners(sequence, 2, [w(1, 'анна')])).toBe('mismatch');
  });
  it('лишний победитель отвергается', () => {
    expect(checkWinners(sequence, 1, [w(1, 'анна'), w(2, 'вера')])).toBe('mismatch');
  });
  it('повторяющиеся и недопустимые позиции отвергаются', () => {
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(1, 'вера')])).toBe('mismatch');
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(3, 'вера')])).toBe('mismatch');
    expect(checkWinners(sequence, 2, [w(0, 'анна'), w(1, 'борис')])).toBe('mismatch');
  });
  it('дубль и чужой участник отвергаются', () => {
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(2, 'анна')])).toBe('mismatch');
    expect(checkWinners(sequence, 1, [w(1, 'пётр')])).toBe('mismatch');
  });
  it('исходный кандидат на чужой позиции отвергается', () => {
    expect(checkWinners(sequence, 2, [w(1, 'анна'), w(2, 'анна')])).toBe('mismatch');
    expect(checkWinners(sequence, 2, [w(1, 'борис'), w(2, 'вера')])).toBe('mismatch');
  });
});
