import { useI18n } from '../i18n.js';
import { outcomeFor } from '../data/codes.js';

export default function ResultView({ result, error, busy, onRetry, onRestart }) {
  const { t } = useI18n();

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
      <p className="muted">
        {t.result.status}: {result.status}
        {t.result.statusNames[result.status] ? ` – ${t.result.statusNames[result.status]}` : ''}
      </p>
      <div className="actions">
        <button className="btn" onClick={onRestart}>{t.result.again}</button>
      </div>
    </section>
  );
}
