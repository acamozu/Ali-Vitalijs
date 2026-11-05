import React, { useEffect, useState } from "react";
import { EVENT } from "./agenda.js";

const DURATION = 3800; // ms before the splash fades out
const FADE = 600;

// 7 people: x position on the stage, colour, height scale, which side they walk in from
const PEOPLE = [
  { x: 60, c: "#5b8cff", h: 1.0, from: -1 },
  { x: 100, c: "#3ddc97", h: 0.9, from: 1 },
  { x: 140, c: "#ffb454", h: 1.05, from: -1 },
  { x: 200, c: "#c77dff", h: 1.1, from: 1 },
  { x: 260, c: "#ff7a90", h: 1.0, from: -1 },
  { x: 300, c: "#4fd1e8", h: 0.92, from: 1 },
  { x: 340, c: "#3ddc97", h: 1.02, from: -1 },
];

const CONFETTI = [
  [70, 40, "#ffb454"], [120, 22, "#5b8cff"], [175, 50, "#ff7a90"], [225, 28, "#3ddc97"],
  [280, 46, "#c77dff"], [330, 24, "#4fd1e8"], [95, 70, "#3ddc97"], [310, 72, "#ffb454"],
];

function Crowd() {
  return (
    <svg className="crowd" viewBox="0 0 400 190" role="img" aria-label="People gathering at the conference">
      {/* spotlight */}
      <polygon className="beam" points="200,0 130,150 270,150" />
      {/* confetti */}
      {CONFETTI.map(([x, y, c], i) => (
        <rect key={i} className="conf" x={x} y={y} width="6" height="10" rx="1.5" fill={c}
          style={{ animationDelay: `${1.6 + i * 0.12}s` }} />
      ))}
      {/* stage */}
      <rect className="stage" x="20" y="150" width="360" height="8" rx="4" />
      {PEOPLE.map((p, i) => (
        <g key={i} transform={`translate(${p.x} 150)`}>
          <g
            className="person"
            style={{ "--from": `${p.from * 190}px`, animationDelay: `${0.25 + i * 0.28}s` }}
          >
            <g className="bob" style={{ animationDelay: `${1.5 + i * 0.1}s` }}>
              <g transform={`scale(${p.h})`}>
                <rect x="-11" y="-46" width="22" height="46" rx="11" fill={p.c} />
                <circle cx="0" cy="-62" r="11" fill={p.c} />
                <circle cx="0" cy="-62" r="11" fill="#fff" opacity=".18" />
              </g>
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}

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
      <Crowd />
      <p className="eyebrow">{EVENT.company}</p>
      <h1>
        Welcome to the<br />
        <span>{EVENT.title}</span> 2026
      </h1>
      <div className="bar"><i style={{ animationDuration: `${DURATION}ms` }} /></div>
    </div>
  );
}
