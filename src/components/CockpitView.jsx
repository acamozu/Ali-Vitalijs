import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n.js';
import { cancelContract } from '../api/verifyApi.js';

const PAGE_SIZE = 20;

const person = (r) => `${r.vorname ?? ''} ${r.nachname ?? ''}`.trim();

// "2025-12-03" -> "03.12.2025" in both languages; an empty ABAP date (0000-00-00) is nothing
const formatDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? '');
  return !m || m[1] === '0000' ? '' : `${m[3]}.${m[2]}.${m[1]}`;
};

const address = (r) => [r.strasse, [r.plz, r.ort].filter(Boolean).join(' '), r.land].filter(Boolean).join(', ');

// description of the feature codes in both languages (the OUT table has no text for EK and only a German one)
const codeNames = {
  EK: { de: 'Energieversorgungskonto', en: 'Energy supply account' },
  AG: { de: 'Anfrage zum Girokonto', en: 'Current account enquiry' },
};

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

// state = { loading, error, data } of the account list; the app loads it (the tab shows its count)
export default function CockpitView({ state, onCancelled }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // id of the account whose contract is to be cancelled
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(''); // message of a failed cancellation, shown in the dialog
  const [notice, setNotice] = useState(''); // "contract cancelled" message above the list
  const scrollRef = useRef(null);

  const { loading, error, data } = state;
  const description = data ? codeNames[data.merkmalcode]?.[lang] || data.beschreibung || '' : '';

  // the count in the title is the filtered one
  const rows = useMemo(() => {
    if (!data) return [];
    const all = data.rows.map((r, id) => ({ ...r, id }));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      [person(r), address(r), r.merkmalcode, description].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [data, query, description]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const closeDialog = () => {
    if (busy) return;
    setConfirm(null);
    setFailure('');
  };

  const cancel = async () => {
    const row = data.rows[confirm];
    setBusy(true);
    setFailure('');
    try {
      await cancelContract(row.partner);
      setConfirm(null);
      setNotice(t.cockpit.cancelled(person(row)));
      onCancelled?.(); // the list is loaded again, the cancelled contract is gone from it
    } catch (e) {
      setFailure(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  // the notice goes away by itself
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (confirm === null) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeDialog();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, busy]);

  // a new page starts at the top of the list, scrolled there smoothly
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [current]);

  return (
    <section className="cockpit view-in">
      <div className="cockpit__head">
        <h2>
          {t.cockpit.title} {data && <span className="cockpit__count">({rows.length})</span>}
        </h2>
      </div>

      {notice && <p className="cockpit__notice" role="status">{notice}</p>}

      <div className="card cockpit__card">
        <label className="cockpit__search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t.cockpit.search}
          />
        </label>

        {loading && !data && <p className="muted cockpit__note" role="status">{t.cockpit.loading}</p>}
        {error && <p className="result__detail">{error}</p>}
        {data && rows.length === 0 && <p className="muted cockpit__note">{t.cockpit.empty}</p>}

        {visible.length > 0 && (
          <>
            <div className="cockpit__scroll" ref={scrollRef}>
              <table className="cockpit__table">
                <thead>
                  <tr>
                    <th>{t.cockpit.columns.person}</th>
                    <th>{t.cockpit.columns.geburtsdatum}</th>
                    <th>{t.cockpit.columns.merkmalcode}</th>
                    <th>{t.cockpit.columns.adresse}</th>
                    <th className="cockpit__end"><span className="sr-only">{t.cockpit.deregister}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={confirm === r.id ? 'is-pending' : ''}>
                      <td>
                        <span className="cockpit__person">
                          <span>
                            <strong>{person(r) || '–'}</strong>
                            <small className="cockpit__sub">
                              {[t.cockpit.gender[r.geschlecht], r.geburtsort].filter(Boolean).join(' · ')}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td data-label={t.cockpit.columns.geburtsdatum}>{formatDate(r.geburtsdatum) || '–'}</td>
                      <td data-label={t.cockpit.columns.merkmalcode}>
                        <strong>{r.merkmalcode}</strong>
                        {description && <small className="cockpit__sub">{description}</small>}
                      </td>
                      <td data-label={t.cockpit.columns.adresse}>{address(r) || '–'}</td>
                      <td className="cockpit__end">
                        <button type="button" className="cockpit__action" onClick={() => setConfirm(r.id)}>
                          {t.cockpit.deregister}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="cockpit__pager" aria-label={t.cockpit.pagination}>
              <span className="muted">
                {(current - 1) * PAGE_SIZE + 1}–{(current - 1) * PAGE_SIZE + visible.length} / {rows.length}
              </span>
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label={t.cockpit.prev}>‹</button>
              <span>{current} / {pages}</span>
              <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label={t.cockpit.next}>›</button>
            </nav>
          </>
        )}
      </div>

      {confirm !== null && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}>
          <div className="modal__box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal__body">
              <span className="modal__icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="48" height="48">
                  <defs>
                    <linearGradient id="warn-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#ffcb47" />
                      <stop offset="1" stopColor="#f29a00" />
                    </linearGradient>
                  </defs>
                  <path d="M24 7 41.5 38h-35z" fill="url(#warn-fill)" stroke="url(#warn-fill)" strokeWidth="6" strokeLinejoin="round" />
                  <rect x="22" y="18" width="4" height="12" rx="2" fill="#fff" />
                  <circle cx="24" cy="34" r="2.4" fill="#fff" />
                </svg>
              </span>
              <div>
                <h3 id="confirm-title">{t.cockpit.confirmTitle}</h3>
                <p>{t.cockpit.confirmOne[0]}<strong>{person(data.rows[confirm])}</strong>{t.cockpit.confirmOne[1]}</p>
                {failure && <p className="modal__error" role="alert">{failure}</p>}
              </div>
            </div>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={closeDialog} disabled={busy} autoFocus>
                {t.cockpit.cancel}
              </button>
              <button type="button" className="btn modal__danger" onClick={cancel} disabled={busy}>
                {busy ? t.cockpit.cancelling : t.cockpit.deregister}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
