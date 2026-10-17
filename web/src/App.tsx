// Розыгрыш призов: список и создание розыгрышей (организатор), заявка и результаты с
// проверкой честности (участник). Адреса: #/ и #/draws/<id>.
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Draw } from './api';
import { canRedraw, redrawFailure } from './redraw';
import { pickWinners, sha256 } from './verify';

const fmt = (iso: string) => new Date(iso).toLocaleString('ru-RU');
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'API недоступен');

function useHash(): string {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function DrawList() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [title, setTitle] = useState('');
  const [prizes, setPrizes] = useState(1);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.list().then(setDraws, (e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const d = await api.create(title, prizes);
      location.hash = `#/draws/${d.id}`;
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <>
      <h2>Розыгрыши</h2>
      <ul>
        {draws.map((d) => (
          <li key={d.id}>
            <a href={`#/draws/${d.id}`}>{d.title}</a> - призов: {d.prizes}, заявок: {d.entries}
            {d.drawnAt ? ', разыгран' : ''}
          </li>
        ))}
      </ul>
      <h3>Новый розыгрыш</h3>
      <form onSubmit={create}>
        <input
          aria-label="Название"
          placeholder="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          aria-label="Призов"
          type="number"
          min={1}
          max={100}
          value={prizes}
          onChange={(e) => setPrizes(Number(e.target.value))}
        />
        <button type="submit">Создать</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function Fairness({ draw }: { draw: Draw }) {
  const [result, setResult] = useState('проверяю...');
  useEffect(() => {
    const { seed, participants } = draw;
    if (!seed || !participants) return;
    (async () => {
      const hashOk = (await sha256(seed)) === draw.seedHash;
      const again = await pickWinners(seed, participants, draw.prizes);
      const winnersOk = again.join() === draw.winners.map((w) => w.participant).join();
      setResult(
        hashOk && winnersOk ? 'результат честный: зерно и победители сходятся' : 'результат НЕ сходится с зерном',
      );
    })();
  }, [draw]);
  return <p data-testid="fairness">{result}</p>;
}

function DrawPage({ id }: { id: number }) {
  const [draw, setDraw] = useState<Draw>();
  const [participant, setParticipant] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => {
    api.get(id).then(setDraw, (e) => setMessage(errorText(e)));
  }, [id]);
  useEffect(load, [load]);
  const act = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f();
      setMessage(ok);
      load();
    } catch (e) {
      setMessage(errorText(e));
    }
  };
  const redraw = async (position: number) => {
    try {
      setDraw(await api.redraw(id, position));
      setMessage('приз разыгран заново');
    } catch (e) {
      setMessage(redrawFailure(errorText(e)));
    }
  };
  if (!draw) return <p role="alert">{message || 'загружаю...'}</p>;
  const open = !draw.drawnAt && new Date(draw.closesAt) > new Date();
  return (
    <>
      <p>
        <a href="#/">все розыгрыши</a>
      </p>
      <h2>{draw.title}</h2>
      <p>
        Призов: {draw.prizes}. Заявок: {draw.entries}. Приём заявок: {fmt(draw.opensAt)} - {fmt(draw.closesAt)}.
      </p>
      <p>
        Хэш зерна (R4): <code data-testid="seed-hash">{draw.seedHash}</code>
      </p>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api.enter(id, participant, birthDate), 'заявка принята');
          }}
        >
          <input
            aria-label="Участник"
            placeholder="Участник"
            value={participant}
            onChange={(e) => setParticipant(e.target.value)}
            required
          />
          <input
            aria-label="Дата рождения"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
          <button type="submit">Подать заявку</button>
        </form>
      )}
      {!draw.drawnAt && (
        <p>
          {open && (
            <button type="button" onClick={() => void act(() => api.close(id), 'приём заявок закончен')}>
              Закончить приём заявок
            </button>
          )}{' '}
          <button type="button" onClick={() => void act(() => api.draw(id), 'победители выбраны')}>
            Выбрать победителей
          </button>
        </p>
      )}
      {message && <p role="alert">{message}</p>}
      {draw.drawnAt && (
        <>
          <h3>Победители</h3>
          <ol>
            {draw.winners.map((w) => (
              <li key={w.position}>
                {w.participant} -{' '}
                {w.status === 'confirmed'
                  ? 'приз подтверждён'
                  : w.status === 'unclaimed'
                    ? 'не востребован'
                    : `подтвердить до ${fmt(w.confirmBy)}`}
                {canRedraw(w) && (
                  <button type="button" onClick={() => void redraw(w.position)}>
                    Разыграть заново
                  </button>
                )}
                {w.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void act(() => api.confirm(id, w.position, w.participant), 'приз подтверждён')}
                  >
                    Подтвердить
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p>
            Зерно: <code data-testid="seed">{draw.seed}</code>
          </p>
          <Fairness draw={draw} />
        </>
      )}
    </>
  );
}

export function App() {
  const hash = useHash();
  const m = /^#\/draws\/(\d+)$/.exec(hash);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>Розыгрыш призов</h1>
      {m ? <DrawPage key={m[1]} id={Number(m[1])} /> : <DrawList />}
    </main>
  );
}
