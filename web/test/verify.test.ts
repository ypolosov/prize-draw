import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/verify';

// Проверка честности в браузере: хэш зерна считается так же, как на сервере (R4).
describe('проверка честности в браузере', () => {
  it('хэш SHA-256 строки - шестнадцатеричный', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
