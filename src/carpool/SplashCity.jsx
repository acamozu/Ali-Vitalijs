import React from "react";

// Line-art skyline for the loading screen: buildings of different heights that share their walls.
// Details are the ones a flat city illustration has: cornice, framed windows with a centre bar,
// awnings, a door, a roof tank with chimney, an antenna, a tall slim window strip.
const GROUND = 130;
const GAP = 6; // between windows
const WIN_H = 10;

const BUILDINGS = [
  { x: 0, w: 56, h: 72, cols: 2, rows: 3, door: true, awning: [1] },
  { x: 56, w: 84, h: 112, cols: 2, rows: 4, door: true, awning: [2, 3] },
  { x: 140, w: 52, h: 124, strip: true },
  { x: 192, w: 66, h: 62, cols: 2, rows: 2, shutters: true, door: true },
  { x: 258, w: 74, h: 96, cols: 3, rows: 3, door: true },
  { x: 332, w: 68, h: 46, cols: 2, rows: 2, awning: [0] },
];

function Building({ x, w, h, cols = 0, rows = 0, door, awning = [], tank, chimney, antenna, strip, shutters }) {
  const top = GROUND - h;
  const out = [];
  out.push(<rect key="body" x={x} y={top} width={w} height={h} fill="#fff" />);
  out.push(<line key="cornice" x1={x} y1={top + 8} x2={x + w} y2={top + 8} />);

  if (cols && rows) {
    const ww = (w - 16 - (cols - 1) * GAP) / cols;
    const areaTop = top + 16;
    const areaH = h - 16 - (door ? 20 : 8);
    const step = rows > 1 ? (areaH - WIN_H) / (rows - 1) : 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 8 + c * (ww + GAP);
        const wy = areaTop + r * step;
        out.push(<rect key={`w${r}${c}`} x={wx} y={wy} width={ww} height={WIN_H} fill="#fff" />);
        out.push(<line key={`m${r}${c}`} x1={wx + ww / 2} y1={wy} x2={wx + ww / 2} y2={wy + WIN_H} />);
        if (shutters) {
          out.push(<line key={`s${r}${c}`} x1={wx - 2} y1={wy - 2} x2={wx + ww + 2} y2={wy - 2} />);
          out.push(<line key={`t${r}${c}`} x1={wx - 2} y1={wy + WIN_H + 2} x2={wx + ww + 2} y2={wy + WIN_H + 2} />);
        } else if (awning.includes(r)) {
          out.push(<path key={`a${r}${c}`} d={`M${wx - 1} ${wy - 1} q${ww / 2 + 1} -7 ${ww + 2} 0`} fill="#fff" />);
        }
      }
    }
  }

  if (strip) {
    // tall slim window strip (the red tower in the illustration)
    const sx = x + 10;
    const sw = 16;
    const sy = top + 16;
    const sh = h - 16 - 8;
    out.push(<rect key="strip" x={sx} y={sy} width={sw} height={sh} fill="#fff" />);
    out.push(<line key="stripm" x1={sx + sw / 2} y1={sy} x2={sx + sw / 2} y2={sy + sh} />);
    for (let i = 1; i < 9; i++) out.push(<line key={`st${i}`} x1={sx} y1={sy + (sh / 9) * i} x2={sx + sw} y2={sy + (sh / 9) * i} />);
    // the side wall next to it, with a few plain slots
    for (let i = 0; i < 6; i++) out.push(<line key={`sd${i}`} x1={x + 34} y1={sy + 6 + i * 18} x2={x + w - 6} y2={sy + 6 + i * 18} />);
  }

  if (door) out.push(<rect key="door" x={x + w / 2 - 5} y={GROUND - 14} width="10" height="14" fill="#fff" />);

  if (tank) {
    out.push(<rect key="tank" x={x + w - 28} y={top - 14} width="18" height="14" fill="#fff" />);
    out.push(<rect key="tankcap" x={x + w - 33} y={top - 8} width="5" height="8" fill="#fff" />);
    out.push(<rect key="chim" x={x + w - 25} y={top - 19} width="8" height="5" fill="#fff" />);
  }
  if (chimney) out.push(<rect key="chimney" x={x + 6} y={top - 8} width="10" height="8" fill="#fff" />);
  if (antenna) {
    out.push(<line key="ant" x1={x + w / 2} y1={top} x2={x + w / 2} y2={top - 14} />);
    out.push(<line key="antx" x1={x + w / 2 - 5} y1={top - 9} x2={x + w / 2 + 5} y2={top - 9} />);
  }
  return <g key={x}>{out}</g>;
}

export default function SplashCity() {
  return (
    <svg className="cp-city" viewBox="-1 -22 402 153" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {BUILDINGS.map((b) => <Building key={b.x} {...b} />)}
    </svg>
  );
}
