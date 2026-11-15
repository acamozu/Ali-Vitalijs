import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CarpoolApp from "./CarpoolApp.jsx";
import SplashCity from "./SplashCity.jsx";
import { EVENT } from "../agenda.js";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "./carpool.css";

// loading screen in the style of the live agenda: the brand fades in letter by letter, then the page name
const BRAND = EVENT.company;
const LETTER_STEP = 60;
const LETTER_FADE = 750;
const BRAND_END = 300 + (BRAND.length - 1) * LETTER_STEP + LETTER_FADE; // the last letter is in
const TITLE_START = BRAND_END; // only now the page name and the road appear
const TITLE_DELAY = TITLE_START - 300;
const TITLE_FADE = 900;
const ROAD_START = TITLE_START + TITLE_FADE + 100; // the road comes only once the page name is fully there
const DRIVE_DELAY = ROAD_START + 250; // then the car drives off
const DRIVE = 1900; // the car crosses the road in this time, at a constant speed
const DASH_MS = Math.round(DRIVE * 0.0932); // one dash period: the road lines flow at the same speed as the roadside light
const DURATION = DRIVE_DELAY + DRIVE + 150; // about 5.3 s in all
const FADE = 700;
const TITLE = { de: "Transfer-Planer", en: "Transfer Planner", ru: "Планировщик трансферов" };
function splashLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q in TITLE) return q;
  try { const s = localStorage.getItem("carpool-lang"); if (s in TITLE) return s; } catch {}
  return "de";
}

function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), DURATION);
    const b = setTimeout(onDone, DURATION + FADE);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <div className={`cp-splash${leaving ? " leaving" : ""}`} role="presentation">
      <h1 className="cp-s-brand" aria-label={BRAND}>
        {[...BRAND].map((ch, i) => (
          <span key={i} aria-hidden="true" className="cp-s-letter" style={{ animationDelay: `${300 + i * LETTER_STEP}ms`, animationDuration: `${LETTER_FADE}ms` }}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </h1>
      <p className="cp-s-title" style={{ animationDelay: `${300 + TITLE_DELAY}ms`, animationDuration: `${TITLE_FADE}ms` }}>
        {TITLE[splashLang()]} <b>2026</b>
      </p>
      <div className="cp-road" aria-hidden="true" style={{ animationDelay: `${ROAD_START}ms` }}>
        <SplashCity />
        <svg className="cp-road-svg" viewBox="0 0 400 93" preserveAspectRatio="none">
          <line x1="0" y1="2" x2="400" y2="2" />
          <line x1="0" y1="91" x2="400" y2="91" />
          <line className="cp-road-mid" x1="0" y1="46.5" x2="400" y2="46.5" pathLength="100" style={{ animationDelay: `${DRIVE_DELAY}ms`, animationDuration: `${DASH_MS}ms` }} />
        </svg>
        <svg className="cp-tl" viewBox="0 0 14 34" aria-hidden="true" style={{ animationDelay: `${DRIVE_DELAY}ms`, animationDuration: `${DRIVE}ms` }}>
          <line x1="7" y1="24" x2="7" y2="34" />
          <rect x="1" y="1" width="12" height="23" rx="2.5" fill="#fff" />
          <circle cx="7" cy="6" r="2.6" fill="#fff" />
          <circle cx="7" cy="12.5" r="2.6" fill="#fff" />
          <circle cx="7" cy="19" r="2.6" fill="#fff" />
          <circle cx="7" cy="19" r="2.6" fill="#000" />
        </svg>
        <svg className="cp-road-car" viewBox="0 0 60 30" aria-hidden="true" style={{ animationDelay: `${DRIVE_DELAY}ms`, animationDuration: `${DRIVE}ms` }}>
          <polygon points="2,23 2,16 10,14 16,5 38,5 46,14 57,16 58,23" />
          <polygon points="18,7.5 25,7.5 25,13.5 13.5,13.5" />
          <polygon points="28,7.5 36.5,7.5 41,13.5 28,13.5" />
          <line x1="26.5" y1="14" x2="26.5" y2="23" />
          <rect x="53" y="17" width="4" height="3" />
          <rect x="2" y="17" width="3" height="3" />
          <circle cx="15" cy="23" r="5.2" />
          <circle cx="46" cy="23" r="5.2" />
          <rect x="14" y="22" width="2" height="2" fill="#000" />
          <rect x="45" y="22" width="2" height="2" fill="#000" />
        </svg>
      </div>
    </div>
  );
}

function Root() {
  const [splash, setSplash] = useState(() => !new URLSearchParams(location.search).has("nosplash"));
  return (
    <>
      <CarpoolApp />
      {splash ? <Splash onDone={() => setSplash(false)} /> : null}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
