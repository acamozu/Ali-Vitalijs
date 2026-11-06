import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, User } from "lucide-react";
import { EVENT, buildSlots, TEXT } from "./agenda.js";
import { fetchOffset, berlinDate, berlinOffset } from "./clock.js";
import Splash from "./Splash.jsx";
import Icon from "./Icons.jsx";
import photo from "./assets/photo-1.webp";
import logo from "./assets/alseda-logo.png";
import { WebIcon, LinkedInIcon } from "./SocialIcons.jsx";

const params = new URLSearchParams(window.location.search);

// agenda layout: default = joined bands with a centre bar (?layout=rings = time rings, ?layout=cards = cards, ?layout=classic = first list)
const layout = ["classic", "cards", "rings"].includes(params.get("layout")) ? params.get("layout") : "bands";

// Public address of the deployed site (encoded in the QR code)
const PUBLIC_URL = "https://alseda-year-end-conference-agenda.netlify.app/";

// ?today -> demo: treat today's date (Germany) as the event day, so the live state can be tried any time
const demoToday = params.has("today");

// Agenda clock: German time from the internet (see clock.js), re-synced every 5 minutes; device clock only as last resort.
// ?now=10:40 simulates a time of day (rehearsal / testing).
function useAgendaClock() {
  const sim = params.get("now");
  const [sync, setSync] = useState({ offset: 0, source: "device" });
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = () =>
      fetchOffset().then((r) => {
        if (alive) setSync(r);
      });
    run();
    const id = setInterval(run, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  useEffect(() => {
    if (sim) return;
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [sim]);

  const nowMs = Date.now() + sync.offset;
  const eventDate = demoToday ? berlinDate(nowMs) : EVENT.date;
  const tz = demoToday ? berlinOffset(nowMs) : EVENT.tz;
  const slots = useMemo(() => buildSlots(eventDate, tz), [eventDate, tz]);
  const now = sim ? new Date(`${eventDate}T${sim}:00${tz}`) : new Date(nowMs);
  return { now, slots, source: sync.source };
}

const fmt = (d) =>
  d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

// time ring: past = full, upcoming = empty, current = share of the event that has passed
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
function ringProgress(slot, st, now) {
  if (st === "past") return 1;
  if (st === "upcoming") return 0;
  if (!slot.to) return 1; // last item has no end time: ring stays full while it runs
  return Math.min(1, Math.max(0, (now - slot.start) / (slot.end - slot.start)));
}

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
  // QR always points to the public site (also in dev); ?url=https://... overrides it (e.g. LAN address for testing).
  const base = params.get("url") || PUBLIC_URL;
  const target = `${base}#agenda`;
  return (
    <main className="landing">
      <img className="landing-photo" src={photo} alt="" />
      <LangSwitch lang={lang} setLang={setLang} className="lang-corner" />
      <div className="landing-inner">
        <div className="landing-text">
          <p className="eyebrow">{EVENT.company}</p>
          <h1>
            {EVENT.title} <span>2026</span>
          </h1>
          <p className="date">
            {t.dateLong}
            <br />
            {EVENT.venue}, Frankfurt
          </p>
        </div>
        <div className="landing-qr">
          <a className="qr" href="#agenda" aria-label={t.openAgenda}>
            <QRCodeSVG value={target} size={512} level="M" marginSize={0} />
          </a>
          <p className="hint">{t.scan}</p>
        </div>
      </div>
      <Footer t={t} className="landing-footer" />
    </main>
  );
}

// same footer on the QR page (pinned to the bottom) and on the agenda page (after the list)
function Footer({ t, className }) {
  return (
    <footer className={className}>
      <img className="lf-logo" src={logo} alt={EVENT.company} />
      <small>
        © {new Date().getFullYear()} {EVENT.company}. {t.rights}
      </small>
      <nav className="lf-links">
        <a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">
          <WebIcon />
        </a>
        <a
          href="https://uk.linkedin.com/company/alseda-consulting"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          title="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      </nav>
    </footer>
  );
}

function Agenda({ lang, setLang, t, ready }) {
  const { now, slots } = useAgendaClock();
  const currentRef = useRef(null);
  const scrolled = useRef(false);
  const olRef = useRef(null);
  const latest = useRef({});
  latest.current = { slots, now };
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // intro: when the page appears, the dot runs down the bar from the top and stops at the current time.
  // phase 0 = running, 1 = real fill revealed under the overlay, 2 = done (live mode)
  const [phase, setPhase] = useState(layout === "bands" && !reduced ? 0 : 2);
  const current = slots.find((s) => now >= s.start && now < s.end) || null;
  const parts = [];
  slots.forEach((s, i) => {
    if (s.section || !parts.length) parts.push({ section: s.section, items: [] });
    parts[parts.length - 1].items.push({ s, i });
  });

  useEffect(() => {
    if (ready && phase === 2 && !scrolled.current && currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      scrolled.current = true;
    }
  }, [current, ready, phase]);

  useEffect(() => {
    if (!ready || phase !== 0) return undefined;
    const ol = olRef.current;
    const fill = ol?.querySelector(".bd-fill");
    const dot = ol?.querySelector(".bd-dot");
    if (!ol || !fill || !dot || !fill.animate) {
      setPhase(2);
      return undefined;
    }
    const { slots: sl, now: nw } = latest.current;
    const rows = [...ol.querySelectorAll(".bd-row")];
    const olRect = ol.getBoundingClientRect();
    const geo = rows.map((li) => {
      const r = li.getBoundingClientRect();
      return { top: r.top - olRect.top, h: r.height };
    });
    // where the dot has to stop: end of the last finished slot, or inside the current one
    let targetY = 0;
    sl.forEach((s, i) => {
      const st = statusOf(s, nw);
      if (st === "past") targetY = geo[i].top + geo[i].h;
      else if (st === "current") targetY = geo[i].top + ringProgress(s, st, nw) * geo[i].h;
    });
    if (targetY <= 0) {
      setPhase(2);
      return undefined;
    }
    const duration = Math.min(3400, Math.max(1400, targetY * 1.1));
    // the bar fill and the dot are transform animations: they run on the compositor and stay smooth
    const opts = { duration, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" };
    fill.style.height = `${targetY}px`;
    const a1 = fill.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], opts);
    const a2 = dot.animate([{ transform: "translateY(0px)" }, { transform: `translateY(${targetY}px)` }], opts);

    // The page moves with the dot, but WITHOUT scrolling: the whole page is translated with the same
    // easing and duration (compositor animation), and at the end it is swapped for a real scroll position
    // in one step (same pixels, no jump). Nothing runs on the main thread while the bar fills.
    const main = ol.closest("main");
    const olPageTop = olRect.top + window.scrollY;
    const y0 = window.scrollY;
    let focusY = targetY;
    sl.forEach((s, i) => {
      if (statusOf(s, nw) === "current") focusY = geo[i].top + geo[i].h / 2; // same spot as the final centring
    });
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollTarget = Math.min(maxScroll, Math.max(0, olPageTop + focusY - window.innerHeight / 2));
    const delta = Math.max(0, scrollTarget - y0);
    let a3 = null;
    if (main && delta > 0) {
      a3 = main.animate([{ transform: "translateY(0px)" }, { transform: `translateY(${-delta}px)` }], opts);
    }
    scrolled.current = true; // this intro already centres the current slot; skip the extra smooth scroll

    let finished = false;
    Promise.all([a1.finished, a2.finished, a3 ? a3.finished : Promise.resolve()])
      .then(() => {
        finished = true;
        // same task: real scroll to the translated position, then drop the transform -> identical frame
        if (a3) window.scrollTo(0, y0 + delta);
        a3?.cancel();
        setPhase(1);
      })
      .catch(() => {});
    return () => {
      if (!finished) {
        a1.cancel();
        a2.cancel();
        a3?.cancel();
      }
    };
  }, [ready, phase]);

  // phase 1: the real per-slot fill is already underneath the overlay; drop the overlay a moment later
  useEffect(() => {
    if (phase !== 1) return undefined;
    const id = window.setTimeout(() => setPhase(2), 120);
    return () => window.clearTimeout(id);
  }, [phase]);

  let status = "";
  if (now < slots[0].start) status = t.before(fmt(slots[0].start));
  else if (now >= slots[slots.length - 1].end) status = t.after;

  return (
    <main className="ag">
      <header className="ag-hero">
        <img className="ag-hero-art" src={photo} alt="" />
        <div className="ag-hero-inner">
          <div className="ag-hero-text">
          <p className="ag-brand">{EVENT.company}</p>
          <h1>{EVENT.title} 2026</h1>
          <p className="ag-meta">
            {t.dateLong}
            <br />
            {EVENT.venue}
            <br />
            <a
              className="ag-addr"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${EVENT.venue}, ${EVENT.address}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${EVENT.address} – Google Maps`}
            >
              {EVENT.address}
            </a>
          </p>
          <LangSwitch lang={lang} setLang={setLang} />
          {status && <p className="ag-status">{status}</p>}
          {current && (
            <button
              type="button"
              className="ag-live"
              onClick={() => currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })}
            >
              <i aria-hidden="true" />
              <span className="ag-live-text">
                {t.now}: {current.title[lang]}
              </span>
              <span className="ag-live-left">{t.left(Math.max(1, Math.ceil((current.end - now) / 60000)))}</span>
            </button>
          )}
          {demoToday && (
            <p className="ag-demo">{fmt(now)}</p>
          )}
          </div>
        </div>
      </header>

      {layout === "classic" ? (
      <ol className="ag-list">
        {slots.map((s, i) => {
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
                {s.speaker && (
                  <p className="r-meta r-line">
                    <User size={14} strokeWidth={1.75} aria-hidden="true" />
                    {s.speaker}
                  </p>
                )}
                {s.location && (
                  <p className="r-meta r-line">
                    <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                    {s.location}
                  </p>
                )}
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
      ) : layout === "cards" ? (
        parts.map((p, pi) => (
          <section key={pi} className={`cd-part part-${pi}`}>
            <h2 className="cd-section">{p.section[lang]}</h2>
            <ol className="cd">
              {p.items.map(({ s, i }) => {
                const st = statusOf(s, now);
                const isCurrent = st === "current";
                return (
                  <li
                    key={s.id}
                    ref={isCurrent ? currentRef : null}
                    className={`cd-row ${s.type} ${st} ${i % 2 === 0 ? "left" : "right"}`}
                  >
                    {s.type === "break" ? (
                      <div className="cd-break">
                        <Icon name={s.icon} size={15} />
                        <time>{fmt(s.start)}</time>
                        <span>{s.title[lang]}</span>
                      </div>
                    ) : (
                      <div className="cd-card">
                        <span className="cd-badge">
                          <svg viewBox="0 0 100 100" aria-hidden="true">
                            <circle className="ring-track" cx="50" cy="50" r={RING_R} />
                            <circle
                              className="ring-fill"
                              cx="50"
                              cy="50"
                              r={RING_R}
                              style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - ringProgress(s, st, now)) }}
                            />
                          </svg>
                          <span className="cd-time">
                            <b>{fmt(s.start)}</b>
                            {s.hasEnd && (
                              <small>
                                {s.minutes} {t.min}
                              </small>
                            )}
                          </span>
                        </span>
                        <div className="cd-text">
                          {isCurrent && (
                            <p className="cd-when">
                              {t.now} · {t.left(Math.max(1, Math.ceil((s.end - now) / 60000)))}
                            </p>
                          )}
                          <p className="cd-title">{s.title[lang]}</p>
                          {s.subtitle && <p className="cd-sub">{s.subtitle[lang]}</p>}
                          {s.speaker && (
                            <p className="cd-meta">
                              <User size={15} strokeWidth={1.75} aria-hidden="true" />
                              {s.speaker}
                            </p>
                          )}
                          {s.location && (
                            <p className="cd-meta">
                              <MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
                              {s.location}
                            </p>
                          )}
                          {isCurrent && (
                            <div className="r-progress">
                              <i style={{ width: `${Math.min(100, Math.max(0, ((now - s.start) / (s.end - s.start)) * 100))}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      ) : layout === "rings" ? (
        <ol className="rg">
          {slots.map((s, i) => {
            const st = statusOf(s, now);
            const isCurrent = st === "current";
            return (
              <React.Fragment key={s.id}>
                <li
                  ref={isCurrent ? currentRef : null}
                  className={`rg-row ${s.type} ${st} ${i % 2 === 0 ? "left" : "right"}`}
                >
                  <div className="rg-text">
                    {isCurrent && <p className="r-tag">{t.now}</p>}
                    <p className="rg-title">{s.title[lang]}</p>
                    {s.subtitle && <p className="rg-sub">{s.subtitle[lang]}</p>}
                    {s.speaker && (
                      <p className="rg-meta">
                        <User size={15} strokeWidth={1.75} aria-hidden="true" />
                        {s.speaker}
                      </p>
                    )}
                    {s.location && (
                      <p className="rg-meta">
                        <MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
                        {s.location}
                      </p>
                    )}
                    {isCurrent && (
                      <div className="r-progress">
                        <i style={{ width: `${Math.min(100, Math.max(0, ((now - s.start) / (s.end - s.start)) * 100))}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="rg-node">
                    <span className="rg-ring">
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <circle className="ring-track" cx="50" cy="50" r={RING_R} />
                        <circle
                          className="ring-fill"
                          cx="50"
                          cy="50"
                          r={RING_R}
                          style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - ringProgress(s, st, now)) }}
                        />
                      </svg>
                      <span className="rg-time">
                        <b>{fmt(s.start)}</b>
                        {isCurrent && s.to ? (
                          <small className="rg-left">
                            {Math.max(1, Math.ceil((s.end - now) / 60000))} {t.min}
                          </small>
                        ) : (
                          <small>{s.to ? `${s.minutes} ${t.min}` : t.openEnd}</small>
                        )}
                      </span>
                    </span>
                  </div>
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      ) : (
        <ol className={`bd ${phase < 2 ? "intro" : ""}`} ref={olRef}>
          {slots.map((s, i) => {
            const st = statusOf(s, now);
            const isCurrent = st === "current";
            const sub =
              isCurrent && s.to
                ? t.left(Math.max(1, Math.ceil((s.end - now) / 60000)))
                : s.to
                  ? `${s.minutes} ${t.min}`
                  : t.openEnd;
            return (
              <li
                key={s.id}
                ref={isCurrent ? currentRef : null}
                className={`bd-row ${s.type} ${st} ${i % 2 === 0 ? "left" : "right"}`}
                style={{ "--rp": phase === 0 ? 0 : ringProgress(s, st, now) }}
              >
                <div className="bd-time">
                  <b>{fmt(s.start)}</b>
                  <small className={isCurrent ? "bd-left" : ""}>{sub}</small>
                </div>
                <div className="bd-axis" aria-hidden="true">
                  <span className="bd-now" />
                </div>
                <div className="bd-text">
                  {isCurrent && <p className="r-tag">{t.now}</p>}
                  <p className="bd-title">{s.title[lang]}</p>
                  {s.subtitle && <p className="bd-sub">{s.subtitle[lang]}</p>}
                  {s.speaker && (
                    <p className="bd-meta">
                      <User size={15} strokeWidth={1.75} aria-hidden="true" />
                      {s.speaker}
                    </p>
                  )}
                  {s.location && (
                    <p className="bd-meta">
                      <a
                        className="bd-map"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${s.location} – Google Maps`}
                      >
                        <span>{s.location}</span>
                      </a>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {phase < 2 && (
            <li className="bd-overlay" aria-hidden="true">
              <span className="bd-fill" />
              <span className="bd-dot" />
            </li>
          )}
        </ol>
      )}
      <Footer t={t} className="landing-footer ag-footer" />
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
        <Agenda lang={lang} setLang={setLang} t={t} ready={!splash} />
      ) : (
        <Landing lang={lang} setLang={setLang} t={t} />
      )}
      {splash && <Splash t={t} onDone={() => setSplash(false)} />}
    </>
  );
}
