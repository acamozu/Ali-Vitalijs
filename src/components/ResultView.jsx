import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.js';
import { outcomeFor } from '../data/codes.js';
import { fetchStatus } from '../api/verifyApi.js';

export default function ResultView({ result, error, busy, onRetry, onRestart, onUpdate }) {
  const { t } = useI18n();

  // the "checking" line changes its wording every few seconds
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setPhrase((p) => p + 1), 2600);
    return () => clearInterval(timer);
  }, []);

  // While the check is "under review", ask the backend every few seconds whether an officer
  // has decided in the BP cockpit; the page then switches to the final result by itself.
  const pending = result && !error && outcomeFor(result.status) === 'review' ? result.requestId : null;
  useEffect(() => {
    if (!pending) return undefined;
    let stopped = false;
    const timer = setInterval(async () => {
      const next = await fetchStatus(pending);
      if (!stopped && next && outcomeFor(next.status) !== 'review') onUpdate?.(next);
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pending, onUpdate]);

  // "Try again": the old error is cleared and the new result is not there yet
  if (busy || (!result && !error)) {
    return (
      <section className="card result view-in" aria-busy="true">
        <span className="btn__spinner result__spinner" aria-hidden="true" />
        <p>{t.form.sending}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card result result--rejected view-in">
        <h2>{t.result.error}</h2>
        <p>{t.result.errorText}</p>
        <p className="result__detail">{error}</p>
        <div className="actions">
          <button className="btn" onClick={onRetry}>{t.result.retry}</button>
          <button className="btn btn--ghost" onClick={onRestart}>{t.result.backToSearch}</button>
        </div>
      </section>
    );
  }

  const outcome = outcomeFor(result.status);
  return (
    <section className={`card result result--${outcome} view-in`}>
      <h2>{t.result[outcome]}</h2>
      <p>{t.result[`${outcome}Text`]}</p>
      {outcome === 'review' && (
        <p className="result__checking" role="status">
          {t.result.checking[phrase % t.result.checking.length]}
          <span className="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
        </p>
      )}
      <div className="actions">
        <button className="btn" onClick={onRestart}>{t.result.again}</button>
      </div>
    </section>
  );
}
