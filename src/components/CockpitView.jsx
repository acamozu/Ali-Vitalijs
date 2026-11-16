import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n.js';
import { fetchCockpit } from '../api/verifyApi.js';

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

export default function CockpitView() {
  const { t, lang } = useI18n();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // { ids } of the accounts to deregister
  const scrollRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    fetchCockpit()
      .then((data) => !stopped && setState({ loading: false, error: '', data }))
      .catch((e) => !stopped && setState({ loading: false, error: e?.message || 'Error', data: null }));
    return () => {
      stopped = true;
    };
  }, []);

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

  const pageIds = visible.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
      return next;
    });

  useEffect(() => {
    if (!confirm) return undefined;
    const onKey = (e) => e.key === 'Escape' && setConfirm(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

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

      <div className="card cockpit__card">
        <div className="cockpit__toolbar">
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
          <button type="button" className="cockpit__action cockpit__bulk" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected] })}>
            {t.cockpit.deregister}{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        {loading && <p className="muted cockpit__note" role="status">{t.cockpit.loading}</p>}
        {error && <p className="result__detail">{error}</p>}
        {data && rows.length === 0 && <p className="muted cockpit__note">{t.cockpit.empty}</p>}

        {visible.length > 0 && (
          <>
            <label className="cockpit__selectall">
              <input
                type="checkbox"
                checked={allOnPage}
                ref={(el) => el && (el.indeterminate = someOnPage && !allOnPage)}
                onChange={togglePage}
              />
              {t.cockpit.selectPage}
            </label>
            <div className="cockpit__scroll" ref={scrollRef}>
              <table className="cockpit__table">
                <thead>
                  <tr>
                    <th className="cockpit__check">
                      <input
                        type="checkbox"
                        checked={allOnPage}
                        ref={(el) => el && (el.indeterminate = someOnPage && !allOnPage)}
                        onChange={togglePage}
                        aria-label={t.cockpit.selectPage}
                      />
                    </th>
                    <th>{t.cockpit.columns.person}</th>
                    <th>{t.cockpit.columns.geburtsdatum}</th>
                    <th>{t.cockpit.columns.merkmalcode}</th>
                    <th>{t.cockpit.columns.adresse}</th>
                    <th className="cockpit__end"><span className="sr-only">{t.cockpit.deregister}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={confirm?.ids.includes(r.id) ? 'is-pending' : selected.has(r.id) ? 'is-selected' : ''}>
                      <td className="cockpit__check">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                          aria-label={t.cockpit.selectRow}
                        />
                      </td>
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
                        <button type="button" className="cockpit__action" onClick={() => setConfirm({ ids: [r.id] })}>
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

      {confirm && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
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
                <h3 id="confirm-title">
                  {t.cockpit.confirmTitle}
                </h3>
                {confirm.ids.length === 1 ? (
                  <p>{t.cockpit.confirmOne[0]}<strong>{person(data.rows[confirm.ids[0]])}</strong>{t.cockpit.confirmOne[1]}</p>
                ) : (
                  <p>{t.cockpit.confirmMany(confirm.ids.length)}</p>
                )}
              </div>
            </div>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)} autoFocus>
                {t.cockpit.cancel}
              </button>
              {/* the deregistration itself is not wired up yet: confirming just closes the dialog */}
              <button type="button" className="btn modal__danger" onClick={() => setConfirm(null)}>
                {t.cockpit.deregister}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
