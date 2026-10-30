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

// Проверка только сверяет опубликованный итог; выбор и сохранение остаются в API.
export async function verifyDraw(draw: import('./api').Draw): Promise<boolean> {
  if (!draw.seed || !draw.participants || (await sha256(draw.seed)) !== draw.seedHash) return false;
  const history = draw.selectionHistory ?? draw.winners;
  const ordered = [...history].sort((a, b) => a.selection - b.selection);
  const initialCount = Math.min(draw.prizes, new Set(draw.participants).size);
  if (ordered.length < initialCount) return false;
  const expected = await pickWinners(draw.seed, draw.participants, ordered.length);
  if (expected.length !== ordered.length) return false;
  const current = new Map<number, import('./api').Winner>();
  for (const [i, winner] of ordered.entries()) {
    if (winner.selection !== i + 1 || winner.participant !== expected[i]) return false;
    if (i < initialCount ? winner.position !== i + 1 : !current.has(winner.position)) return false;
    const previous = current.get(winner.position);
    if (previous && previous.status !== 'unclaimed') return false;
    current.set(winner.position, winner);
  }
  return (
    draw.winners.length === current.size &&
    draw.winners.every((w) => {
      const verified = current.get(w.position);
      return verified?.selection === w.selection && verified.participant === w.participant;
    })
  );
}
