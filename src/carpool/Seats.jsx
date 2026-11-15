import { useState, useRef, createContext, useContext } from "react";
import { NO_TAG } from "./tags.js";
import { Info, Plus, Car, Train, Ticket } from "lucide-react";

// seat map: front row = driver + front passenger, then rows of up to 3. Two seats in a row sit left/right of the aisle.
// every entry keeps its seat index so a seat can be addressed while dragging.
export function seatRows(slots) {
  const list = slots.map((p, i) => ({ p, i }));
  const rows = [list.slice(0, 2)];
  for (let i = 2; i < list.length; i += 3) rows.push(list.slice(i, i + 3));
  return rows.filter((r) => r.length);
}

// two ways to move passengers (drivers never move, their seat is not a target):
//  - tap a passenger, then tap a target seat (works everywhere, the way to go on a phone: the page can be scrolled in between)
//  - mouse: drag the passenger onto a seat
export function useSeatDrag(onSwap) {
  const [drag, setDrag] = useState(null); // { car, idx, person, x, y, over }
  const st = useRef({ active: false });
  const swapRef = useRef(onSwap);
  swapRef.current = onSwap;

  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-seat]");
    if (!el) return null;
    const [car, idx] = el.dataset.seat.split(":");
    return { car, idx: Number(idx) };
  };

  const start = (e, from, person) => {
    if (e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0)) return; // touch uses tap-to-select
    const s = st.current;
    s.active = false;
    s.sx = e.clientX;
    s.sy = e.clientY;

    const cleanup = () => {
      s.active = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cleanup);
      setDrag(null);
    };
    const move = (ev) => {
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) <= 5) return;
        s.active = true;
        setDrag({ car: from.car, idx: from.idx, person, x: ev.clientX, y: ev.clientY, over: null });
        return;
      }
      const over = targetAt(ev.clientX, ev.clientY);
      setDrag((d) => d && { ...d, x: ev.clientX, y: ev.clientY, over });
    };
    const up = (ev) => {
      const over = s.active ? targetAt(ev.clientX, ev.clientY) : null;
      cleanup();
      if (over && !(String(over.car) === String(from.car) && over.idx === from.idx)) swapRef.current(from, over);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cleanup);
  };

  return { drag, start };
}

// team / language colour of a person (only while a grouping is chosen)
export const TagCtx = createContext({ by: "none", of: () => "", color: () => NO_TAG, title: () => "" });

// the language of a person (DE / EN / RU) written top right of the seat, no colour dots
export function TagDot({ p, className = "lang-tag" }) {
  const tg = useContext(TagCtx);
  if (!p.lang) return null;
  return (
    <span className={className} title={tg.title(p)}>
      {p.lang}
    </span>
  );
}

// a small "i" for people with a note (Rollstuhl, Gepäck, ...): the note shows on hover
export function NoteFlag({ note, inline }) {
  return (
    <span className={`note-flag${inline ? " inline" : ""}`} title={note} aria-label={note}>
      <Info size="100%" aria-hidden />
    </span>
  );
}

export function Seat({ p, idx, carId, dnd, pick, t }) {
  const key = `${carId}:${idx}`;
  const d = dnd.drag;
  const dragging = d && String(d.car) === String(carId) && d.idx === idx;
  const over = d && d.over && String(d.over.car) === String(carId) && d.over.idx === idx && !dragging;
  const picked = pick.picked && String(pick.picked.car) === String(carId) && pick.picked.idx === idx;
  const fx = `${dragging ? " is-dragging" : ""}${over ? " is-over" : ""}${picked ? " is-picked" : ""}`;
  const tap = {
    "data-seat": key,
    role: "button",
    tabIndex: 0,
    "aria-pressed": !!picked,
    onClick: () => pick.onTap({ car: carId, idx }, !!p),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick.onTap({ car: carId, idx }, !!p);
      }
    },
  };

  if (!p) {
    return (
      <div className={`seat empty${fx}`} {...tap}>
        <span className="seat-name">{t.free}</span>
      </div>
    );
  }
  const driver = idx === 0;
  return (
    <div
      className={`seat ${driver ? "driver" : "rider"}${fx}`}
      {...(driver
        ? {}
        : {
            ...tap,
            onPointerDown: (e) => dnd.start(e, { car: carId, idx }, p),
            onContextMenu: (e) => e.preventDefault(),
          })}
    >
      <TagDot p={p} />
      {p.note ? <NoteFlag note={p.note} /> : null}
      {driver ? <span className="seat-role">{t.driver}</span> : null}
      <span className="seat-name">
        {p.name.split(" ").map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </span>
      {p.team ? (
        <span className="seat-region" title={p.team}>
          {p.team}
        </span>
      ) : null}
    </div>
  );
}

export function CarMap({ carId, slots, dnd, pick, t }) {
  return (
    <div className="car-map" role="group" aria-label={`${t.car} ${carId}`}>
      <svg className="car-art" viewBox="0 0 300 560" aria-hidden="true">
        {/* tyres (under the body) */}
        <g className="tire">
          <rect x="8" y="64" width="22" height="64" rx="8" />
          <rect x="270" y="64" width="22" height="64" rx="8" />
          <rect x="8" y="388" width="22" height="64" rx="8" />
          <rect x="270" y="388" width="22" height="64" rx="8" />
        </g>
        {/* body: rounded shape, wing mirrors are part of the outline */}
        <path
          className="body"
          d="M22 90 C22 40 70 8 150 8 C230 8 278 40 278 90 L278 133 L296 146 Q303 150 303 156 L303 160 Q303 164 298 164 L278 164 L278 470 C278 530 240 556 150 556 C60 556 22 530 22 470 L22 164 L2 164 Q-3 164 -3 160 L-3 156 Q-3 150 4 146 L22 133 Z"
        />
        {/* hood: grille, gold headlights, creases */}
        <path className="grille" d="M112 16 C130 10 170 10 188 16 L182 34 C166 30 134 30 118 34 Z" />
        <path className="lamp" d="M44 58 C54 42 78 30 104 28 L98 60 C80 60 60 62 44 58 Z" />
        <path className="lamp" d="M256 58 C246 42 222 30 196 28 L202 60 C220 60 240 62 256 58 Z" />

        <path className="crease" d="M110 60 C104 80 104 96 108 104" />
        <path className="crease" d="M190 60 C196 80 196 96 192 104" />
        {/* glass: windscreen, side windows, rear window */}
        <path className="glass" d="M38 150 C58 112 104 98 150 98 C196 98 242 112 262 150 L250 196 C222 186 78 186 50 196 Z" />
        <path className="glass" d="M26 212 L47 198 L47 396 L28 420 Z" />
        <path className="glass" d="M274 212 L253 198 L253 396 L272 420 Z" />
        <path className="glass" d="M52 404 C80 410 220 410 248 404 L262 450 C236 466 190 472 150 472 C110 472 64 466 38 450 Z" />
        {/* door seam: thin body-coloured bar across each side window */}
        <path className="seam" d="M26 308 H47 M274 308 H253" />
        {/* roof (body colour) with a soft shine */}
        <path className="roof" d="M50 196 C78 186 222 186 250 196 L250 382 Q250 398 234 398 L66 398 Q50 398 50 382 Z" />
        <path className="shine" d="M52 300 C90 270 150 236 214 196 C236 192 246 194 250 196 L250 250 C200 300 130 360 66 398 Q52 396 52 382 Z" />
        {/* tail lights, number plate */}
        <path className="tail" d="M32 500 C36 526 52 540 76 542 L78 520 C60 520 44 512 32 500 Z" />
        <path className="tail" d="M268 500 C264 526 248 540 224 542 L222 520 C240 520 256 512 268 500 Z" />
        <rect className="plate" x="124" y="534" width="52" height="12" rx="3" />
      </svg>
      <div className="car-seats">
        {seatRows(slots).map((row, r) => (
          <div key={r} className={`seat-row n${row.length}`}>
            {row.map(({ p, i }) => (
              <Seat key={i} p={p} idx={i} carId={carId} dnd={dnd} pick={pick} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// one place in a tram group or taxi: tap / drag like a car seat; in groups the ticket icon picks the buyer
export function Slot({ p, idx, boxId, kind, dnd, pick, t, buyer, onBuyer }) {
  const d = dnd.drag;
  const here = (x) => x && String(x.car) === String(boxId) && x.idx === idx;
  const fx = `${here(d) ? " is-dragging" : ""}${d && here(d.over) && !here(d) ? " is-over" : ""}${here(pick.picked) ? " is-picked" : ""}`;
  const tap = {
    "data-seat": `${boxId}:${idx}`,
    role: "button",
    tabIndex: 0,
    "aria-pressed": !!here(pick.picked),
    onClick: () => pick.onTap({ car: boxId, idx }, !!p),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick.onTap({ car: boxId, idx }, !!p);
      }
    },
  };
  if (!p) {
    return (
      <li className={`pp slot empty${fx}`} {...tap}>
        <span className="dot free"><Plus size={14} aria-hidden /></span>
        <span className="pp-name">{t.free}</span>
      </li>
    );
  }
  const Icon = kind === "taxi" ? Car : Train;
  return (
    <li
      className={`pp slot${fx}`}
      {...tap}
      onPointerDown={(e) => dnd.start(e, { car: boxId, idx }, p)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={`dot ${kind === "taxi" ? "car" : "train"}`}>
        <Icon size={15} aria-hidden />
      </span>
      <span className="pp-name">{p.name}</span>
      {p.team ? (
        <span className="team-chip" title={p.team}>
          {p.team}
        </span>
      ) : null}
      <TagDot p={p} className="lang-tag inline" />
      {p.note ? <NoteFlag note={p.note} inline /> : null}
      {kind === "tram" ? (
        <button
          className={`buy${buyer ? " on" : ""}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBuyer();
          }}
          aria-pressed={buyer}
          aria-label={`${t.makeBuyer}: ${p.name}`}
          title={t.makeBuyer}
        >
          <Ticket size={13} aria-hidden />
          {buyer ? <span>{t.buyer}</span> : null}
        </button>
      ) : null}
    </li>
  );
}
