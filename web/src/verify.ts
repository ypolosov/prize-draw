// Проверка честности в браузере (R4): хэш раскрытого зерна совпадает с опубликованным, а
// победители пересчитываются из зерна тем же способом, что в API (ADR-3).
const enc = new TextEncoder();

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(key: string, msg: string): Promise<DataView> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new DataView(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

export async function pickWinners(seed: string, participants: string[], prizes: number): Promise<string[]> {
  const pool = [...new Set(participants)].sort();
  const winners: string[] = [];
  for (let i = 0; i < prizes && pool.length > 0; i++) {
    const n = (await hmac(seed, `pick:${i}`)).getBigUint64(0);
    const [w] = pool.splice(Number(n % BigInt(pool.length)), 1);
    if (w !== undefined) winners.push(w);
  }
  return winners;
}

// Победители сходятся с зерном (ADR-3): приз на позиции p - либо исходный выбор pickWinners,
// либо кандидат из продолжения последовательности после первых `prizes` выборов (повтор приза).
// История повторов API не отдаёт, поэтому порядок повторов не проверяется; произвольный
// участник, дубль или чужой кандидат на позиции исходного выбора отвергаются.
export function winnersMatch(
  sequence: string[],
  prizes: number,
  winners: { position: number; participant: string }[],
): boolean {
  const names = winners.map((w) => w.participant);
  if (new Set(names).size !== names.length) return false;
  const tail = new Set(sequence.slice(prizes));
  return winners.every((w) => sequence[w.position - 1] === w.participant || tail.has(w.participant));
}
