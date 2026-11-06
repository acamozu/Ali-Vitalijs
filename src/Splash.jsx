import React, { useEffect, useState } from "react";
import { EVENT } from "./agenda.js";

const BRAND = EVENT.company; // "alseda Consulting"
const LETTER_STEP = 90; // ms between letters
const LETTER_FADE = 900; // ms each letter takes to fade in
const BRAND_END = BRAND.length * LETTER_STEP + LETTER_FADE;
const TITLE_DELAY = BRAND_END + 150; // title starts right after the last letter
const TITLE_FADE = 1400;
const DURATION = TITLE_DELAY + TITLE_FADE + 1100; // hold a moment, then leave
const FADE = 700;

export default function Splash({ t, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), DURATION);
    const t2 = setTimeout(onDone, DURATION + FADE);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="presentation">
      <h1 className="s-brand" aria-label={BRAND}>
        {[...BRAND].map((ch, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="letter"
            style={{ animationDelay: `${300 + i * LETTER_STEP}ms`, animationDuration: `${LETTER_FADE}ms` }}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </h1>
      <p className="s-title" style={{ animationDelay: `${300 + TITLE_DELAY}ms`, animationDuration: `${TITLE_FADE}ms` }}>
        <span className="s-welcome">{t.welcome}</span>
        {EVENT.title} <b>2026</b>
      </p>
    </div>
  );
}
