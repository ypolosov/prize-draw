import { useEffect, useState } from 'react';
import { ApiError, api, type Draw } from './api';
import { prizeView, redrawPrize } from './prize';
import { verifyDraw } from './verify';

export function Results({ draw, update }: { draw: Draw; update: (draw: Draw) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [check, setCheck] = useState('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (attempt < 0) return;
    setCheck('checking');
    verifyDraw(draw).then(
      (ok) => {
        if (active) setCheck(ok ? 'ok' : 'bad');
      },
      () => {
        if (active) setCheck('bad');
      },
    );
    return () => {
      active = false;
    };
  }, [draw, attempt]);
  const redraw = async (position: number) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      update(await redrawPrize(draw, position, api.redraw));
    } catch (e) {
      setError(
        e instanceof ApiError && e.message.includes('кандидатов')
          ? 'Разыграть приз некому: в розыгрыше не осталось участников, которые ещё не выигрывали. Приз остаётся невостребованным. Победитель приза не изменился.'
          : 'Не удалось выполнить повтор. Обновите страницу и попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  };
  const confirm = async (position: number, participant: string) => {
    setBusy(true);
    try {
      update(await api.confirm(draw.id, position, participant));
    } catch {
      setError('Не удалось подтвердить приз. Обновите страницу и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  const unclaimed = draw.winners.find((w) => w.status === 'unclaimed');
  return (
    <>
      <section className="redraw-layout">
        <div className="prize-main">
          {unclaimed && (
            <section className="hero">
              <div className="actions">
                <span className="badge bad">Невостребованный приз</span>
                <span className="badge">{draw.title}</span>
              </div>
              <h2 className="display">Приз ждёт нового победителя</h2>
              <p className="lead">
                {unclaimed.participant} не подтвердил приз за 3 дня, приз невостребован. Разыграйте его заново: новый
                победитель выбирается среди тех, кто ещё не выигрывал в этом розыгрыше.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void redraw(unclaimed.position)}
                >
                  Разыграть заново
                </button>
                <a className="btn" href="#redraw-help">
                  Как это работает
                </a>
              </div>
            </section>
          )}
          <h3 className="section-title">Призы и победители</h3>
          <div className="prize-grid">
            {draw.winners.map((w) => {
              const view = prizeView(w);
              return (
                <article className={view.canRedraw ? 'card attention' : 'card'} key={w.position}>
                  <span className={`badge ${view.tone}`}>{view.text}</span>
                  <h3 className="card-title">Приз за место {w.position}</h3>
                  <p>Победитель: {w.participant}</p>
                  {w.status === 'pending' && (
                    <p className="status">Подтвердить до {new Date(w.confirmBy).toLocaleString('ru-RU')}</p>
                  )}
                  {w.status === 'pending' && (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => void confirm(w.position, w.participant)}
                    >
                      Подтвердить
                    </button>
                  )}
                  {view.canRedraw && (
                    <>
                      <p>Приз не подтверждён за 3 дня</p>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busy}
                        onClick={() => void redraw(w.position)}
                      >
                        Разыграть заново
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <aside className="panel">
          <h3>Победители призов</h3>
          <ol className="winners">
            {draw.winners.map((w) => (
              <li className="winner" key={w.position}>
                <span>{w.position}</span>
                <span>{w.participant}</span>
                <span className={`badge ${prizeView(w).tone}`}>{prizeView(w).text}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>
      {draw.winners.map((w) => {
        const previous =
          draw.selectionHistory?.filter((old) => old.position === w.position && old.selection < w.selection) ?? [];
        return (
          previous.length > 0 && (
            <section className="panel" key={w.position}>
              <span className="badge ok">Повтор прошёл</span>
              <h2>У приза новый победитель — {w.participant}</h2>
              <p>Приз разыгран заново среди участников, которые ещё не выигрывали.</p>
              <p>Подтвердить приз до {new Date(w.confirmBy).toLocaleString('ru-RU')}.</p>
              <p className="alert">
                История места {w.position}: {previous.map((old) => old.participant).join(', ')} — приз не подтверждён в
                срок.
              </p>
            </section>
          )
        );
      })}
      {error && (
        <section className="alert error" role="alert">
          <span className="badge bad">Повтор не прошёл</span>
          <h2>Не удалось разыграть приз заново</h2>
          <p>{error}</p>
          <button type="button" className="btn primary" onClick={() => setError('')}>
            Понятно
          </button>
        </section>
      )}
      <p id="redraw-help" className="muted">
        Новый победитель выбирается среди оставшихся участников. У него есть 3 дня, чтобы подтвердить приз.
      </p>
      <section className="verification">
        <h2>Проверка после повторного выбора</h2>
        <p className="muted">Браузер независимо проверяет первоначальный и повторный выбор.</p>
        <div className={check === 'bad' ? 'card alert error' : 'card'} data-testid="fairness" role="status">
          <span className={`badge ${check === 'ok' ? 'ok' : check === 'bad' ? 'bad' : 'wait'}`}>
            {check === 'checking' ? 'Идёт проверка' : check === 'ok' ? 'Результат проверен' : 'Проверка не прошла'}
          </span>
          <h2>
            {check === 'checking' ? 'Проверяем результат' : check === 'ok' ? 'Все совпало' : 'Результаты не совпали'}
          </h2>
          <p>
            {check === 'checking'
              ? 'Независимо проверяем первый и повторный результат. Это займёт несколько секунд.'
              : check === 'ok'
                ? 'Оба результата совпали с независимой проверкой. Проверено в вашем браузере.'
                : 'Не доверяйте этому итогу. Обновите страницу или сообщите организатору розыгрыша.'}
          </p>
          {check === 'bad' && (
            <button type="button" className="btn primary" onClick={() => setAttempt(attempt + 1)}>
              Повторить проверку
            </button>
          )}
        </div>
      </section>
    </>
  );
}
