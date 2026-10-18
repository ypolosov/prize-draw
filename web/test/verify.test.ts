import { describe, expect, it } from 'vitest';
import { pickWinners, recomputeWinners, sha256 } from '../src/verify';

// Проверка честности в браузере: хэш зерна считается так же, как на сервере (R4).
describe('проверка честности в браузере', () => {
  it('хэш SHA-256 строки - шестнадцатеричный', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

const people = ['анна', 'борис', 'вера', 'глеб', 'дина', 'егор'];

describe('пересчёт победителей с повторами', () => {
  it('без повторов совпадает с прежним пересчётом', async () => {
    const first = await pickWinners('seed', people, 2);
    expect(await recomputeWinners('seed', people, 2)).toEqual(first);
    expect(await recomputeWinners('seed', people, 2, [])).toEqual(first);
  });

  it('повтор - следующий выбор последовательности среди оставшихся', async () => {
    const three = await pickWinners('seed', people, 3);
    const got = await recomputeWinners('seed', people, 2, [{ position: 1, participant: three[0] ?? '' }]);
    expect(got).toEqual([three[2], three[1]]);
  });

  it('два повтора подряд на одном месте', async () => {
    const four = await pickWinners('seed', people, 4);
    const got = await recomputeWinners('seed', people, 1, [
      { position: 1, participant: four[0] ?? '' },
      { position: 1, participant: four[1] ?? '' },
    ]);
    expect(got).toEqual([four[2]]);
  });

  it('расхождение: прежний победитель места указан неверно', async () => {
    expect(await recomputeWinners('seed', people, 2, [{ position: 1, participant: 'чужой' }])).toBeUndefined();
  });

  it('расхождение: кандидатов для повтора нет', async () => {
    const all = await pickWinners('seed', people, 6);
    expect(await recomputeWinners('seed', people, 6, [{ position: 1, participant: all[0] ?? '' }])).toBeUndefined();
  });
});
