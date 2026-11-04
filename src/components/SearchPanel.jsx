import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.js';
import { usageOptions, zipToCity } from '../data/tariffs.js';

const locales = { de: 'de-DE', en: 'en-GB' };
// The tariffs are local mock data, so the wait is artificial. Remove it once a real lookup is behind this.
const SEARCH_DELAY_MS = 900;

export default function SearchPanel({ initial, onSearch }) {
  const { t, lang } = useI18n();
  const fmt = (n) => n.toLocaleString(locales[lang]);

  const [zip, setZip] = useState(initial?.zip ?? '');
  const [usage, setUsage] = useState(initial?.usage ?? usageOptions[1]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const usageRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const city = /^\d{5}$/.test(zip) ? zipToCity[zip] : undefined;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (usageRef.current && !usageRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (option) => {
    setUsage(option);
    setOpen(false);
  };

  const applyCustom = () => {
    const kwh = Number(custom);
    if (!Number.isInteger(kwh) || kwh <= 0) return;
    choose(usageOptions.find((o) => o.kwh === kwh) ?? { kwh, persons: null });
  };

  const openPopover = () => {
    setCustom(String(usage.kwh));
    setOpen((o) => !o);
  };

  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!/^\d{5}$/.test(zip)) return setError(t.search.zipInvalid);
    if (!city) return setError(t.search.zipUnknown);
    setError('');
    setOpen(false);
    setLoading(true);
    timerRef.current = setTimeout(() => {
      setLoading(false);
      onSearch({ zip, city, usage });
    }, SEARCH_DELAY_MS);
  };

  return (
    <form className="search card view-in" onSubmit={submit}>
      <h2 className="search__title">{t.search.title}</h2>
      <div className="search__row">
        <label className="pill">
          <span className="pill__label">{t.search.zip}</span>
          <input
            className="pill__input"
            value={zip}
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
          />
        </label>

        <div className="usage" ref={usageRef}>
          <button
            type="button"
            className="pill pill--button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={openPopover}
          >
            <span className="pill__label">{t.search.usage}</span>
            <span className="pill__value">
              <strong>{fmt(usage.kwh)}</strong> <span className="pill__hint">{t.search.unit}</span>
            </span>
            <span className="pill__spacer" />
            {usage.persons && <span className="pill__hint">{t.search.persons(usage.persons)}</span>}
            <svg className="pill__chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8l8 8 8-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <div className="usage__popover" role="dialog" aria-label={t.search.usage}>
              <p className="usage__title">{t.search.recommendation}</p>
              <ul className="usage__list">
                {usageOptions.map((o) => {
                  const selected = o.kwh === usage.kwh;
                  return (
                    <li key={o.kwh}>
                      <button
                        type="button"
                        className={`usage__option ${selected ? 'is-selected' : ''}`}
                        onClick={() => choose(o)}
                      >
                        <span className="usage__check">{selected ? '✓' : ''}</span>
                        <span className="usage__kwh">{fmt(o.kwh)} {t.search.unit}</span>
                        <span>{t.search.persons(o.persons)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="usage__custom">
                <label className="pill">
                  <span className="pill__label">{t.search.custom}</span>
                  <input
                    className="pill__input"
                    value={custom}
                    inputMode="numeric"
                    onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCustom();
                      }
                    }}
                  />
                  <span className="pill__hint">{t.search.unit}</span>
                </label>
                <button type="button" className="btn usage__apply" onClick={applyCustom}>
                  {t.search.apply}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className={`btn btn--large ${loading ? 'is-loading' : ''}`}
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading && <span className="btn__spinner" aria-hidden="true" />}
          {loading ? t.search.calculating : t.search.calculate}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
