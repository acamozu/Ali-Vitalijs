import { useEffect, useMemo, useRef, useState } from 'react';
import { I18nContext, messages } from './i18n.js';
import { verifyBp } from './api/verifyApi.js';
import SearchPanel from './components/SearchPanel.jsx';
import TariffList from './components/TariffList.jsx';
import StepForm from './components/StepForm.jsx';
import ResultView from './components/ResultView.jsx';
import logo from './assets/alseda-logo.png';

const readLang = () => {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'de';
  } catch {
    return 'de';
  }
};

// Duration of the fade-out before the next view is shown (matches .is-leaving in styles.css).
const FADE_MS = 300;
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [lang, setLangState] = useState(readLang);
  const [view, setView] = useState('search'); // search | tariffs | form | result
  const [search, setSearch] = useState(null);
  const [tariff, setTariff] = useState(null);
  const [lastForm, setLastForm] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(''); // message of a failed check, '' = none
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [searchNo, setSearchNo] = useState(0); // new key per search, so the tariffs animate in again
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Fade the current view out and scroll up, then swap it, so a view change is not a hard cut.
  const go = (next, apply) => {
    if (leaving) return;
    if (next === view) {
      apply?.();
      return;
    }
    if (prefersReducedMotion()) {
      apply?.();
      setView(next);
      window.scrollTo({ top: 0 });
      return;
    }
    setLeaving(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    timerRef.current = setTimeout(() => {
      apply?.();
      setView(next);
      setLeaving(false);
    }, FADE_MS);
  };

  const i18n = useMemo(() => {
    const setLang = (l) => {
      setLangState(l);
      try {
        localStorage.setItem('lang', l);
      } catch {
        /* storage unavailable, language just won't persist */
      }
    };
    return { t: messages[lang], lang, setLang };
  }, [lang]);

  const submit = async (form) => {
    setLastForm(form);
    setBusy(true);
    setError('');
    try {
      setResult(await verifyBp(form));
    } catch (e) {
      setResult(null);
      // the backend's message as it is, shown on the result page
      setError(e?.message || 'Error');
    } finally {
      setBusy(false);
      go('result');
    }
  };

  const restart = () => {
    go('search', () => {
      setTariff(null);
      setResult(null);
      setError('');
    });
  };

  return (
    <I18nContext.Provider value={i18n}>
      <header className="topbar">
        <span className="brand">
          <img className="brand__logo" src={logo} alt="" />
          <strong>{i18n.t.brand}</strong>
        </span>
        <div className="lang" role="group" aria-label="Language">
          {['de', 'en'].map((l) => (
            <button key={l} className={l === lang ? 'is-on' : ''} onClick={() => i18n.setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className={`page ${leaving ? 'is-leaving' : ''}`}>
        {(view === 'search' || view === 'tariffs') && (
          <SearchPanel
            initial={search}
            onSearch={(s) => {
              setSearch(s);
              setSearchNo((n) => n + 1);
              setView('tariffs');
            }}
          />
        )}
        {view === 'tariffs' && (
          <TariffList
            key={searchNo}
            search={search}
            onSelect={(tf) => go('form', () => setTariff(tf))}
          />
        )}
        {view === 'form' && (
          <StepForm tariff={tariff} search={search} busy={busy} onSubmit={submit} onBack={() => go('tariffs')} />
        )}
        {view === 'result' && (
          <ResultView result={result} error={error} busy={busy} onRetry={() => submit(lastForm)} onRestart={restart} />
        )}
      </main>
    </I18nContext.Provider>
  );
}
