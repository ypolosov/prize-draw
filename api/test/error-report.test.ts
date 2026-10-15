import { describe, expect, it } from 'vitest';
import { errorEvent, parseDsn } from '../src/error-report';

describe('сбор ошибок API', () => {
  it('DSN -> адрес store API и ключ', () => {
    expect(parseDsn('http://abc@glitchtip:8000/3')).toEqual({
      storeUrl: 'http://glitchtip:8000/api/3/store/',
      publicKey: 'abc',
    });
    expect(parseDsn('')).toBeUndefined();
    expect(parseDsn('http://glitchtip:8000/3')).toBeUndefined();
  });

  it('событие: тип, сообщение, стек и запрос без номеров', () => {
    const e = errorEvent(new TypeError('сломалось'), { method: 'POST', url: '/api/draws/12/entries' }, 'v1.0.0');
    expect(e.release).toBe('v1.0.0');
    expect(e.transaction).toBe('POST /api/draws/:id/entries');
    expect(e.culprit).toBe('POST /api/draws/:id/entries');
    expect(e.culprit).toBe(e.transaction);
    const ex = (e.exception as { values: { type: string; value: string; stacktrace: { frames: unknown[] } }[] })
      .values[0];
    expect(ex?.type).toBe('TypeError');
    expect(ex?.value).toBe('сломалось');
    expect(ex?.stacktrace.frames.length).toBeGreaterThan(0);
  });
});
