import React, { useEffect, useState } from "react";
import { EVENT } from "./agenda.js";

const DURATION = 3600; // ms before the splash fades out
const FADE = 600;

// each word fades in one after another
const WORDS = [
  { t: "Welcome to the", cls: "w-small" },
  { t: "Year-End", cls: "w-big" },
  { t: "Conference", cls: "w-big" },
  { t: "2026", cls: "w-year" },
];

export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), DURATION);
    const t2 = setTimeout(onDone, DURATION + FADE);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const skip = () => {
    setLeaving(true);
    setTimeout(onDone, FADE);
  };

  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} onClick={skip} role="presentation">
      <p className="s-brand">{EVENT.company}</p>
      <h1>
        {WORDS.map((w, i) => (
          <span key={i} className={`word ${w.cls}`} style={{ animationDelay: `${0.4 + i * 0.55}s` }}>
            {w.t}
          </span>
        ))}
      </h1>
      <div className="s-line">
        <i style={{ animationDuration: `${DURATION - 300}ms` }} />
      </div>
    </div>
  );
}
