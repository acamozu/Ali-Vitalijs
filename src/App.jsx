import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { EVENT, SLOTS, EVENT_START, EVENT_END } from "./agenda.js";
import Splash from "./Splash.jsx";
import conferenceArt from "./assets/conference.webp";

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

function Landing() {
  // QR always points to the public site; ?url=https://... overrides it (e.g. LAN address for testing).
  // In dev mode we use the current address so local testing still works.
  const base =
    params.get("url") ||
    (import.meta.env.DEV ? window.location.href.split("#")[0].replace(/[?].*$/, "") : PUBLIC_URL);
  const target = `${base}#agenda`;
  return (
    <main className="landing">
      <img className="landing-bg" src={conferenceArt} alt="" />
      <div className="landing-inner">
        <div className="landing-text">
          <p className="eyebrow">{EVENT.company}</p>
          <h1>
            {EVENT.title} <span>2026</span>
          </h1>
          <p className="date">27. November 2026 · {EVENT.venue}, Frankfurt</p>
        </div>
        <div className="landing-qr">
          <a className="qr" href="#agenda" aria-label="Agenda öffnen">
            <QRCodeSVG value={target} size={512} level="M" marginSize={0} />
          </a>
          <p className="hint">QR-Code scannen und die Live-Agenda öffnen</p>
        </div>
      </div>
    </main>
  );
}

function Banner({ now, current, next }) {
  let label = "";
  let title = "";
  let sub = "";
  if (now < EVENT_START) {
    label = "Starting soon";
    title = SLOTS[0].title;
    sub = `Doors open at ${fmt(EVENT_START)}`;
  } else if (now >= EVENT_END) {
    label = "Event ended";
    title = "Thank you for joining us!";
    sub = "See you next year";
  } else if (current) {
    label = current.type === "break" ? "Break right now" : "Happening now";
    title = current.title;
    sub =
      `${fmt(current.start)} – ${current.to ? fmt(current.end) : "open end"}` +
      (next ? ` · Next: ${next.title} at ${fmt(next.start)}` : "");
  }
  return (
    <section className={`banner ${current ? current.type : ""}`}>
      <span className="live">
        <i /> {label}
      </span>
      <h2>{title}</h2>
      <p>{sub}</p>
    </section>
  );
}

function Item({ slot, status, open, onToggle, refEl }) {
  const hasDetail = slot.speaker || slot.subtitle || slot.location;
  return (
    <li ref={refEl} className={`item ${slot.type} ${status} ${open ? "open" : ""}`}>
      <div className="time">
        <b>{fmt(slot.start)}</b>
        {slot.to && <small>{fmt(slot.end)}</small>}
      </div>
      <div className="rail">
        <span className="dot" />
      </div>
      <button className="card" onClick={onToggle} disabled={!hasDetail} aria-expanded={open}>
        <div className="head">
          <h3>{slot.title}</h3>
          {status === "current" && <span className="chip">NOW</span>}
          {slot.minutes && <span className="mins">{slot.minutes} min</span>}
        </div>
        {slot.speaker && <p className="speaker">{slot.speaker}</p>}
        {open && (
          <div className="detail">
            {slot.subtitle && <p>{slot.subtitle}</p>}
            {slot.speaker && (
              <p>
                <em>Speaker:</em> {slot.speaker}
              </p>
            )}
            {slot.location ? (
              <p>
                <em>Location:</em> {slot.location}
              </p>
            ) : (
              slot.type !== "social" && (
                <p>
                  <em>Location:</em> {EVENT.venue}, {EVENT.address}
                </p>
              )
            )}
          </div>
        )}
      </button>
    </li>
  );
}

function Agenda() {
  const now = useNow();
  const [openId, setOpenId] = useState(null);
  const currentRef = useRef(null);
  const scrolled = useRef(false);

  const { current, next } = useMemo(() => {
    const c = SLOTS.find((s) => now >= s.start && now < s.end) || null;
    const n = SLOTS.find((s) => s.start > now) || null;
    return { current: c, next: n };
  }, [now]);

  useEffect(() => {
    if (!scrolled.current && currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      scrolled.current = true;
    }
  }, [current]);

  return (
    <main className="agenda">
      <header>
        <a href="#" className="back" aria-label="Back">
          ←
        </a>
        <div>
          <p className="eyebrow">{EVENT.company}</p>
          <h1>{EVENT.title} 2026</h1>
          <p className="date">27 Nov 2026 · {EVENT.venue}</p>
        </div>
      </header>
      <Banner now={now} current={current} next={next} />
      <ol className="timeline">
        {SLOTS.map((s) => (
          <Item
            key={s.id}
            slot={s}
            status={statusOf(s, now)}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            refEl={current && current.id === s.id ? currentRef : null}
          />
        ))}
      </ol>
    </main>
  );
}

export default function App() {
  const hash = useHash();
  const [splash, setSplash] = useState(!params.has("nosplash"));
  return (
    <>
      {hash === "#agenda" ? <Agenda /> : <Landing />}
      {splash && <Splash onDone={() => setSplash(false)} />}
    </>
  );
}
