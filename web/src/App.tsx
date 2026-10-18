// Розыгрыш призов: список и создание розыгрышей (организатор), заявка и результаты с
// проверкой честности (участник). Адреса: #/ и #/draws/<id>. Вид - по макетам дизайнера,
// классы - из styles.css.
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Draw, type Winner } from './api';
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

// Сообщение после действия: ошибка правила или API - красным, итог - нейтрально.
function Message({ text, error }: { text: string; error: boolean }) {
  return (
    <p role="alert" className={error ? 'alert error' : 'alert'}>
      {text}
    </p>
  );
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
      <section className="panel">
        <h2 className="section-title">Розыгрыши</h2>
        <ul className="draws">
          {draws.map((d) => (
            <li key={d.id}>
              <a href={`#/draws/${d.id}`}>{d.title}</a>
              <span className="muted">
                призов: {d.prizes}, заявок: {d.entries}
              </span>
              {d.drawnAt ? <span className="badge ok">разыгран</span> : <span className="badge wait">идёт</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3 className="section-title">Новый розыгрыш</h3>
        <form className="form" onSubmit={create}>
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
          <button className="btn primary" type="submit">
            Создать
          </button>
        </form>
      </section>
      {error && <Message text={error} error />}
    </>
  );
}

function Fairness({ draw }: { draw: Draw }) {
  const [result, setResult] = useState('проверяю...');
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const { seed, participants } = draw;
    if (!seed || !participants) return;
    (async () => {
      const hashOk = (await sha256(seed)) === draw.seedHash;
      const again = await pickWinners(seed, participants, draw.prizes);
      const winnersOk = again.join() === draw.winners.map((w) => w.participant).join();
      setOk(hashOk && winnersOk);
      setResult(
        hashOk && winnersOk ? 'результат честный: зерно и победители сходятся' : 'результат НЕ сходится с зерном',
      );
    })();
  }, [draw]);
  return (
    <p data-testid="fairness" className={ok ? 'verdict' : 'verdict bad'}>
      {result}
    </p>
  );
}

// Состояние приза победителя: текст и цвет.
function prizeStatus(w: Winner): { text: string; tone: string } {
  if (w.status === 'confirmed') return { text: 'приз подтверждён', tone: 'status ok' };
  if (w.status === 'unclaimed') return { text: 'не востребован', tone: 'status bad' };
  return { text: `подтвердить до ${fmt(w.confirmBy)}`, tone: 'status' };
}

function DrawPage({ id }: { id: number }) {
  const [draw, setDraw] = useState<Draw>();
  const [participant, setParticipant] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    api.get(id).then(setDraw, (e) => {
      setMessage(errorText(e));
      setFailed(true);
    });
  }, [id]);
  useEffect(load, [load]);
  const act = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f();
      setMessage(ok);
      setFailed(false);
      load();
    } catch (e) {
      setMessage(errorText(e));
      setFailed(true);
    }
  };
  if (!draw) return <Message text={message || 'загружаю...'} error={failed} />;
  const open = !draw.drawnAt && new Date(draw.closesAt) > new Date();
  const stage = draw.drawnAt ? 'победители выбраны' : open ? 'приём заявок' : 'приём заявок закончен';
  return (
    <>
      <p>
        <a href="#/">все розыгрыши</a>
      </p>
      <section className="hero">
        <span className="badge">{stage}</span>
        <h2 className="display">{draw.title}</h2>
        <p className="lead">
          Призов: {draw.prizes}. Заявок: {draw.entries}. Приём заявок: {fmt(draw.opensAt)} - {fmt(draw.closesAt)}.
        </p>
        <p className="muted">
          Хэш зерна (R4): <code data-testid="seed-hash">{draw.seedHash}</code>
        </p>
      </section>
      {open && (
        <section className="panel">
          <h3 className="section-title">Заявка на участие</h3>
          <form
            className="form"
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
            <button className="btn primary" type="submit">
              Подать заявку
            </button>
          </form>
        </section>
      )}
      {!draw.drawnAt && (
        <div className="actions">
          {open && (
            <button
              className="btn"
              type="button"
              onClick={() => void act(() => api.close(id), 'приём заявок закончен')}
            >
              Закончить приём заявок
            </button>
          )}
          <button
            className="btn primary"
            type="button"
            onClick={() => void act(() => api.draw(id), 'победители выбраны')}
          >
            Выбрать победителей
          </button>
        </div>
      )}
      {message && <Message text={message} error={failed} />}
      {draw.drawnAt && (
        <>
          <section className="panel">
            <h3 className="section-title">Победители</h3>
            <ol className="winners">
              {draw.winners.map((w) => {
                const s = prizeStatus(w);
                return (
                  <li className="winner" key={w.position}>
                    <span className="place">{w.position}</span>
                    <span className="winner-name">{w.participant}</span>
                    <span className={s.tone}>{s.text}</span>
                    {w.status === 'pending' && (
                      <button
                        className="btn primary small"
                        type="button"
                        onClick={() => void act(() => api.confirm(id, w.position, w.participant), 'приз подтверждён')}
                      >
                        Подтвердить
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="panel">
            <h3 className="section-title">Честная игра</h3>
            <p className="muted">
              Зерно: <code data-testid="seed">{draw.seed}</code>
            </p>
            <Fairness draw={draw} />
          </section>
        </>
      )}
    </>
  );
}

export function App() {
  const hash = useHash();
  const m = /^#\/draws\/(\d+)$/.exec(hash);
  return (
    <div className="app">
      <nav className="side" aria-label="Разделы">
        <a className="brand" href="#/">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 3 9l9 13 9-13z" fill="#e5304b" />
            <path d="M3 9h18" stroke="#ff8095" strokeWidth="1.5" />
          </svg>
          Розыгрыш
        </a>
        <p className="side-label">РОЗЫГРЫШИ</p>
        <a className={m ? 'nav-link' : 'nav-link active'} href="#/">
          Мои розыгрыши
        </a>
      </nav>
      <div className="content">
        <header className="topbar">
          <h1>Розыгрыш призов</h1>
        </header>
        <main className="page">{m ? <DrawPage key={m[1]} id={Number(m[1])} /> : <DrawList />}</main>
      </div>
    </div>
  );
}
