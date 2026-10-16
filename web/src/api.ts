// Клиент API розыгрыша: ошибки правил приходят с кодом правила (R1-R6).
export interface Winner {
  position: number;
  participant: string;
  status: 'pending' | 'confirmed' | 'unclaimed';
  confirmBy: string;
}

export interface Draw {
  id: number;
  title: string;
  prizes: number;
  opensAt: string;
  closesAt: string;
  seedHash: string;
  entries: number;
  seed?: string;
  drawnAt?: string;
  participants?: string[];
  winners: Winner[];
}

export class ApiError extends Error {
  readonly rule?: string;
  readonly status?: number;
  constructor(message: string, rule?: string, status?: number) {
    super(message);
    this.rule = rule;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { message?: unknown; rule?: string };
  if (!r.ok)
    throw new ApiError(
      Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? r.status),
      data.rule,
      r.status,
    );
  return data as T;
}

export const api = {
  list: () => call<Draw[]>('GET', '/draws'),
  get: (id: number) => call<Draw>('GET', `/draws/${id}`),
  create: (title: string, prizes: number) => call<Draw>('POST', '/draws', { title, prizes }),
  enter: (id: number, participant: string, birthDate: string) =>
    call<{ participant: string }>('POST', `/draws/${id}/entries`, { participant, birthDate }),
  close: (id: number) => call<Draw>('POST', `/draws/${id}/close`),
  draw: (id: number) => call<Draw>('POST', `/draws/${id}/draw`),
  confirm: (id: number, position: number, participant: string) =>
    call<Draw>('POST', `/draws/${id}/winners/${position}/confirm`, { participant }),
  redraw: (id: number, position: number) => call<Draw>('POST', `/draws/${id}/winners/${position}/redraw`),
};
