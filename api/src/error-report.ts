// Сбор ошибок API по протоколу Sentry (store API) - его принимает GlitchTip стенда фабрики.
// Чистые функции: разбор DSN и событие ошибки; отправка - в error-filter.ts.
import { randomUUID } from 'node:crypto';

export interface Dsn {
  storeUrl: string;
  publicKey: string;
}

// DSN вида http://КЛЮЧ@ХОСТ[/ПРЕФИКС]/ПРОЕКТ -> адрес store API и открытый ключ.
export function parseDsn(dsn: string | undefined): Dsn | undefined {
  if (!dsn) return undefined;
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return undefined;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const project = parts.pop();
  if (!url.username || !project || !/^\d+$/.test(project)) return undefined;
  const prefix = parts.length ? `/${parts.join('/')}` : '';
  return { storeUrl: `${url.protocol}//${url.host}${prefix}/api/${project}/store/`, publicKey: url.username };
}

// Стек V8 -> кадры Sentry: самый внешний вызов первым, место ошибки последним.
export function frames(stack: string) {
  const out: { filename: string; function: string; lineno: number; colno: number; in_app: boolean }[] = [];
  for (const line of stack.split('\n')) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!m?.[2]) continue;
    out.push({
      filename: m[2],
      function: m[1] ?? '?',
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !m[2].startsWith('node:') && !m[2].includes('/node_modules/'),
    });
  }
  return out.reverse();
}

export function errorEvent(
  error: unknown,
  req: { method?: string; url?: string },
  release: string | undefined,
  now = new Date(),
): Record<string, unknown> {
  const err = error instanceof Error ? error : new Error(String(error));
  const place = `${req.method ?? ''} ${(req.url ?? '').replace(/\d+/g, ':id')}`.trim();
  return {
    event_id: randomUUID().replaceAll('-', ''),
    timestamp: now.toISOString(),
    platform: 'node',
    level: 'error',
    release: release || undefined,
    environment: 'stand',
    transaction: place,
    culprit: place,
    request: { method: req.method, url: req.url },
    exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: frames(err.stack ?? '') } }] },
  };
}
