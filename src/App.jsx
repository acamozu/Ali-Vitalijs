import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { EVENT, SLOTS, EVENT_START, EVENT_END, TEXT } from "./agenda.js";
import Splash from "./Splash.jsx";
import Icon from "./Icons.jsx";
import conferenceArt from "./assets/conference.webp";
import conferenceWhite from "./assets/conference-white.webp";

const params = new URLSearchParams(window.location.search);

// Public address of the deployed site (encoded in the QR code)
const PUBLIC_URL = "https://ornate-pudding-2bac72.netlify.app/";

// ?now=10:40  -> simulate a time on the event day (for testing / rehearsal)
function useNow() {
  const sim = params.get("now");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sim) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [sim]);
  if (sim) return new Date(`${EVENT.date}T${sim}:00${EVENT.tz}`);
  return new Date(now);
}

const fmt = (d) =>
  d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

function statusOf(slot, now) {
  if (now >= slot.end) return "past";
  if (now >= slot.start) return "current";
  return "upcoming";
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setHash(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return hash;
}

// language: ?lang=en|de, else the last choice (localStorage), else German
function useLang() {
  const [lang, setLang] = useState(() => {
    const q = params.get("lang");
    if (q === "de" || q === "en") return q;
    try {
      const v = localStorage.getItem("lang");
      if (v === "de" || v === "en") return v;
    } catch {
      /* storage not available */
    }
    return "de";
  });
  const change = (l) => {
    setLang(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* storage not available */
    }
  };
  return [lang, change];
}

function LangSwitch({ lang, setLang, className = "" }) {
  return (
    <div className={`lang ${className}`} role="group" aria-label="Language">
      {["de", "en"].map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Landing({ lang, setLang, t }) {
  // QR always points to the public site; ?url=https://... overrides it (e.g. LAN address for testing).
  // In dev mode we use the current address so local testing still works.
  const base =
    params.get("url") ||
    (import.meta.env.DEV ? window.location.href.split("#")[0].replace(/[?].*$/, "") : PUBLIC_URL);
  const target = `${base}#agenda`;
  return (
    <main className="landing">
      <img className="landing-bg" src={conferenceArt} alt="" />
      <LangSwitch lang={lang} setLang={setLang} className="lang-corner" />
      <div className="landing-inner">
        <div className="landing-text">
          <p className="eyebrow">{EVENT.company}</p>
          <h1>
            {EVENT.title} <span>2026</span>
          </h1>
          <p className="date">
            {t.dateLong} · {EVENT.venue}, Frankfurt
          </p>
        </div>
        <div className="landing-qr">
          <a className="qr" href="#agenda" aria-label={t.openAgenda}>
            <QRCodeSVG value={target} size={512} level="M" marginSize={0} />
          </a>
          <p className="hint">{t.scan}</p>
        </div>
      </div>
    </main>
  );
}

function Agenda({ lang, setLang, t }) {
  const now = useNow();
  const currentRef = useRef(null);
  const scrolled = useRef(false);
  const current = SLOTS.find((s) => now >= s.start && now < s.end) || null;

  useEffect(() => {
    if (!scrolled.current && currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      scrolled.current = true;
    }
  }, [current]);

  let status = "";
  if (now < EVENT_START) status = t.before(fmt(EVENT_START));
  else if (now >= EVENT_END) status = t.after;

  return (
    <main className="ag">
      <header className="ag-hero">
        <img className="ag-hero-art" src={conferenceWhite} alt="" />
        <div className="ag-hero-inner">
          <p className="ag-brand">{EVENT.company}</p>
          <h1>{EVENT.title} 2026</h1>
          <p className="ag-meta">
            {t.dateLong} · {EVENT.venue}
            <br />
            {EVENT.address}
          </p>
          <LangSwitch lang={lang} setLang={setLang} />
          {status && <p className="ag-status">{status}</p>}
        </div>
      </header>

      <ol className="ag-list">
        {SLOTS.map((s, i) => {
          const st = statusOf(s, now);
          const isCurrent = st === "current";
          return (
            <li
              key={s.id}
              ref={isCurrent ? currentRef : null}
              className={`row ${s.type} ${st} ${i % 2 === 0 ? "left" : "right"}`}
            >
              <div className="r-when">
                <time>{fmt(s.start)}</time>
                {s.hasEnd && s.type !== "break" && (
                  <span>
                    {s.minutes} {t.min}
                  </span>
                )}
              </div>
              <div className="r-node" aria-hidden="true">
                <span className="bubble">
                  <Icon name={s.icon} size={s.type === "break" ? 15 : 20} />
                </span>
              </div>
              <div className="r-body">
                {isCurrent && (
                  <p className="r-tag">
                    {t.now} · {t.left(Math.max(1, Math.ceil((s.end - now) / 60000)))}
                  </p>
                )}
                <p className="r-title">{s.title[lang]}</p>
                {s.subtitle && <p className="r-sub">{s.subtitle[lang]}</p>}
                {s.speaker && <p className="r-meta">{s.speaker}</p>}
                {s.location && <p className="r-meta">{s.location}</p>}
                {isCurrent && (
                  <div className="r-progress">
                    <i style={{ width: `${Math.min(100, Math.max(0, ((now - s.start) / (s.end - s.start)) * 100))}%` }} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

export default function App() {
  const hash = useHash();
  const [lang, setLang] = useLang();
  const t = TEXT[lang];
  const [splash, setSplash] = useState(!params.has("nosplash"));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      {hash === "#agenda" ? (
        <Agenda lang={lang} setLang={setLang} t={t} />
      ) : (
        <Landing lang={lang} setLang={setLang} t={t} />
      )}
      {splash && <Splash t={t} onDone={() => setSplash(false)} />}
    </>
  );
}
