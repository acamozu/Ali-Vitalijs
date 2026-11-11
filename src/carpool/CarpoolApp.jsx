import React, { useEffect, useMemo, useRef, useState } from "react";
import { Car, Plane, Train, Ticket, Shuffle, Check, CircleUserRound } from "lucide-react";
import { EVENT, AGENDA } from "../agenda.js";
import photo from "../assets/photo-1.webp";
import logo from "../assets/alseda-logo.png";
import { WebIcon, LinkedInIcon } from "../SocialIcons.jsx";
import { generatePersons, planTrip, CAR_SEATS, TAXI_SEATS, GROUP_TICKET_MAX } from "./planner.js";

// default seed: 4 cars (5 seats) -> 20 by car / 15 by tram / 5 by taxi
const DEFAULT_SEED = 8;

const TEXT = {
  de: {
    brand: "alseda Year-End",
    title: "Anreise zur Year-End Conference",
    sub: "Fahrgemeinschaften, Tram & Taxi – automatisch aus den Anreisedaten geplant.",
    demo: "Demo mit 40 fiktiven Testpersonen – keine echten Namen.",
    to: "Ziel",
    date: "Datum",
    begin: "Beginn",
    oclock: "Uhr",
    navCars: "Autos",
    navTram: "Tram",
    navTaxi: "Taxi",
    navAll: "Alle",
    persons: "Personen",
    byCar: "im Auto",
    byTram: "mit der Tram",
    byTaxi: "im Taxi",
    seats: "Sitzplätze pro Auto (inkl. Fahrer)",
    barLabel: "Testdaten anpassen",
    newData: "Neue Testdaten",
    seed: "Testdaten",
    carsH: "Fahrgemeinschaften",
    carsSub: "Fahrer nehmen zuerst Mitfahrer aus ihrer Region mit.",
    dragHint: "Fahrgast antippen, dann Zielsitz antippen. Fahrer bleiben im Auto.",
    picked: "ausgewählt – Zielsitz antippen",
    cancel: "Abbrechen",
    car: "Auto",
    driver: "Fahrer:in",
    free: "frei",
    tramH: "Tram / ÖPNV",
    tramSub: `Ab Frankfurt Hbf, Gruppen bis ${GROUP_TICKET_MAX} Personen. Eine Person pro Gruppe kauft das Gruppenticket.`,
    group: "Gruppe",
    buyer: "Gruppenticket",
    taxiH: "Taxi",
    taxiSub: `Flughafen-Gruppe und kleine Reste (1–2 Personen) – max. ${TAXI_SEATS} pro Taxi.`,
    taxi: "Taxi",
    fromFRA: "ab Flughafen FRA",
    fromHBF: "ab Frankfurt Hbf",
    nothing: "Keine Gruppe nötig.",
    allH: "Alle Personen",
    mode: { car: "Auto", train: "Bahn", plane: "Flug" },
    assign: "Zuordnung",
    name: "Name",
    start: "Start",
    way: "Anreise",
    filterAll: "Alle",
    ruleH: "So wird verteilt",
    ruleSub: "Vier einfache Regeln – mehr steckt nicht dahinter.",
    rules: [
      "Wer mit dem Auto kommt, fährt selbst und nimmt Mitfahrer:innen mit, bis alle Plätze belegt sind (Fahrer eingerechnet).",
      "Mitfahrer sind Bahn-Reisende; sie werden dem Auto aus der gleichen oder nächstgelegenen Region zugeteilt.",
      "Wer fliegt, wird am Flughafen als Gruppe abgeholt (Taxi).",
      `Alle übrigen fahren ab Hbf mit der Tram in Gruppen bis ${GROUP_TICKET_MAX} Personen; ein Rest unter 3 Personen nimmt ein Taxi.`,
    ],
    darkH: "Alle 40 kommen ans Ziel",
    rights: "Alle Rechte vorbehalten.",
  },
  en: {
    brand: "alseda Year-End",
    title: "Getting to the Year-End Conference",
    sub: "Carpools, tram and taxi – planned automatically from the arrival data.",
    demo: "Demo with 40 fictional test persons – no real names.",
    to: "Destination",
    date: "Date",
    begin: "Start",
    oclock: "",
    navCars: "Cars",
    navTram: "Tram",
    navTaxi: "Taxi",
    navAll: "All",
    persons: "persons",
    byCar: "by car",
    byTram: "by tram",
    byTaxi: "by taxi",
    seats: "Seats per car (incl. driver)",
    barLabel: "Adjust test data",
    newData: "New test data",
    seed: "Test data",
    carsH: "Carpools",
    carsSub: "Drivers take passengers from their own region first.",
    dragHint: "Tap a passenger, then tap a target seat. Drivers stay put.",
    picked: "selected – tap a target seat",
    cancel: "Cancel",
    car: "Car",
    driver: "Driver",
    free: "free",
    tramH: "Tram / public transport",
    tramSub: `From Frankfurt Hbf, groups of up to ${GROUP_TICKET_MAX}. One person per group buys the group ticket.`,
    group: "Group",
    buyer: "Group ticket",
    taxiH: "Taxi",
    taxiSub: `Airport group and small leftovers (1–2 people) – max. ${TAXI_SEATS} per taxi.`,
    taxi: "Taxi",
    fromFRA: "from FRA airport",
    fromHBF: "from Frankfurt Hbf",
    nothing: "No group needed.",
    allH: "All persons",
    mode: { car: "Car", train: "Train", plane: "Plane" },
    assign: "Assignment",
    name: "Name",
    start: "Start",
    way: "Travel",
    filterAll: "All",
    ruleH: "How people are assigned",
    ruleSub: "Four simple rules – that is all there is to it.",
    rules: [
      "People arriving by car drive themselves and take passengers until all seats are taken (driver included).",
      "Passengers are train travellers; they are matched with the car from the same or nearest region.",
      "People flying in are picked up at the airport as a group (taxi).",
      `Everyone else takes the tram from Hbf in groups of up to ${GROUP_TICKET_MAX}; a rest of fewer than 3 people takes a taxi.`,
    ],
    darkH: "All 40 reach the venue",
    rights: "All rights reserved.",
  },
};

const MODE_ICON = { car: Car, train: Train, plane: Plane };
const RULE_GRADS = ["var(--grad-peach)", "var(--grad-lilac)", "var(--grad-blue)", "var(--grad-green)"];

function useLang() {
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "de" || q === "en") return q;
    try {
      const s = localStorage.getItem("carpool-lang");
      if (s === "de" || s === "en") return s;
    } catch {}
    return "de";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("carpool-lang", lang);
    } catch {}
  }, [lang]);
  return [lang, setLang];
}

// tiles are shown right away (no scroll animation)
function Reveal({ as: Tag = "section", className = "", children, ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  );
}

// seat map: front row = driver + front passenger, then rows of up to 3. Two seats in a row sit left/right of the aisle.
// every entry keeps its seat index so a seat can be addressed while dragging.
function seatRows(slots) {
  const list = slots.map((p, i) => ({ p, i }));
  const rows = [list.slice(0, 2)];
  for (let i = 2; i < list.length; i += 3) rows.push(list.slice(i, i + 3));
  return rows.filter((r) => r.length);
}

// two ways to move passengers (drivers never move, their seat is not a target):
//  - tap a passenger, then tap a target seat (works everywhere, the way to go on a phone: the page can be scrolled in between)
//  - mouse: drag the passenger onto a seat
function useSeatDrag(onSwap) {
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

function Seat({ p, idx, carId, dnd, pick, t }) {
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
      {driver ? <span className="seat-role">{t.driver}</span> : null}
      <span className="seat-name">
        {p.name.split(" ").map((w) => (
          <span key={w}>{w}</span>
        ))}
      </span>
      <span className="seat-region">{p.region}</span>
    </div>
  );
}

function CarMap({ carId, slots, dnd, pick, t }) {
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

function Person({ p, badge }) {
  const Icon = MODE_ICON[p.mode];
  return (
    <li className="pp">
      <span className={`dot ${p.mode}`}>
        <Icon size={15} aria-hidden />
      </span>
      <span className="pp-name">{p.name}</span>
      {badge}
      <span className="pp-region">{p.region}</span>
    </li>
  );
}

export default function CarpoolApp() {
  const [lang, setLang] = useLang();
  const t = TEXT[lang];
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [seats, setSeats] = useState(CAR_SEATS);
  const [filter, setFilter] = useState("all");

  const persons = useMemo(() => generatePersons(seed), [seed]);
  const plan = useMemo(() => planTrip(persons, seats), [persons, seats]);

  // seat layout per car (person id or null, index 0 = driver). Starts from the plan; drag & drop edits it.
  // it is reset whenever the test data or the number of seats changes.
  const planKey = `${seed}:${seats}`;
  const baseMap = useMemo(
    () =>
      Object.fromEntries(
        plan.cars.map((c) => {
          const s = [c.driver.id, ...c.passengers.map((p) => p.id)];
          while (s.length < seats) s.push(null);
          return [c.id, s];
        })
      ),
    [plan, seats]
  );
  const [edit, setEdit] = useState(null); // { key, map }
  const seatMap = edit && edit.key === planKey ? edit.map : baseMap;
  const [picked, setPicked] = useState(null); // { car, idx } of the passenger chosen by tapping
  useEffect(() => {
    // new test data / seat count: back to the planned layout
    setEdit(null);
    setPicked(null);
  }, [planKey]);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  const byId = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);

  // move a passenger to a free seat or swap two passengers (any car); drivers never move
  const swapSeats = (a, b) => {
    if (a.idx === 0 || b.idx === 0) return;
    const m = Object.fromEntries(Object.entries(seatMap).map(([k, v]) => [k, [...v]]));
    const tmp = m[a.car][a.idx];
    m[a.car][a.idx] = m[b.car][b.idx];
    m[b.car][b.idx] = tmp;
    setEdit({ key: planKey, map: m });
  };
  const dnd = useSeatDrag(swapSeats);

  // tap a passenger, then a seat: move or swap. Tapping the chosen seat again cancels. Driver seats do nothing.
  const onTap = (pos, hasPerson) => {
    if (!picked) {
      if (hasPerson) setPicked(pos);
      return;
    }
    if (String(picked.car) === String(pos.car) && picked.idx === pos.idx) {
      setPicked(null);
      return;
    }
    swapSeats(picked, pos);
    setPicked(null);
  };
  const pick = { picked, onTap };
  const pickedPerson = picked ? byId[seatMap[picked.car]?.[picked.idx]] : null;

  // where every person ended up (for the full list)
  const assignment = useMemo(() => {
    const m = new Map();
    plan.cars.forEach((c) => {
      seatMap[c.id].forEach((id, i) => {
        if (id) m.set(id, { kind: "car", label: `${t.car} ${c.id}`, role: i === 0 ? t.driver : undefined });
      });
    });
    plan.tramGroups.forEach((g) =>
      g.members.forEach((p) =>
        m.set(p.id, { kind: "tram", label: `${t.group} ${g.id}`, role: p.id === g.buyer.id ? t.buyer : null })
      )
    );
    plan.taxis.forEach((x) => x.members.forEach((p) => m.set(p.id, { kind: "taxi", label: `${t.taxi} ${x.id}` })));
    return m;
  }, [plan, seatMap, t]);

  const eventDate = new Date(EVENT.date + "T12:00:00").toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const rows = persons.filter((p) =>
    filter === "all" ? true : filter === "driver" ? p.mode === "car" : assignment.get(p.id)?.kind === filter
  );
  const planes = persons.filter((p) => p.mode === "plane").length;
  const trains = persons.filter((p) => p.mode === "train").length;

  return (
    <div className={`cp${dnd.drag ? " dragging" : ""}${picked ? " picking" : ""}`}>
      {pickedPerson ? (
        <div className="pick-bar" role="status">
          <span>
            <strong>{pickedPerson.name}</strong> {t.picked}
          </span>
          <button onClick={() => setPicked(null)}>{t.cancel}</button>
        </div>
      ) : null}
      {dnd.drag ? (
        <div className="drag-ghost" style={{ left: dnd.drag.x, top: dnd.drag.y }}>
          {dnd.drag.person.name}
        </div>
      ) : null}
      <header className="cp-nav">
        <img className="cp-logo" src={logo} alt="alseda Consulting" />
        <div className="cp-nav-right">
          <nav className="cp-nav-links">
            <a href="#cars">{t.navCars}</a>
            <a href="#tram">{t.navTram}</a>
            <a href="#taxi">{t.navTaxi}</a>
            <a href="#all">{t.navAll}</a>
          </nav>
          <div className="cp-lang" role="group" aria-label="Language">
            {["de", "en"].map((l) => (
              <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)} aria-pressed={l === lang}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="cp-wrap">
        <div className="cp-bento">
         <div className="cp-inner">
          {/* hero */}
          <div className="cp-hero">
            <div className="tile hero-main">
              <img className="hero-photo" src={photo} alt="" />
              <h1>
                {t.title.split("Year-End").flatMap((part, i, a) =>
                  i < a.length - 1 ? [part, <span key={i} style={{ whiteSpace: "nowrap" }}>Year-End</span>] : [part]
                )}
              </h1>
              <p>{t.sub}</p>
            </div>
            <div className="hero-side">
              <div className="hero-holo lilac">
                <p className="holo-label">{t.to}</p>
                <p className="holo-venue">{EVENT.venue}</p>
                <p className="holo-addr">{EVENT.address}</p>
              </div>
              <div className="hero-holo green">
                <dl className="holo-facts">
                  <div>
                    <dt>{t.date}</dt>
                    <dd>{eventDate}</dd>
                  </div>
                  <div>
                    <dt>{t.begin}</dt>
                    <dd>{AGENDA[0].from} {t.oclock}</dd>
                  </div>
                  <div>
                    <dt>{t.persons}</dt>
                    <dd>{persons.length}</dd>
                  </div>
                </dl>
                <p className="holo-demo">
                  <span>{t.demo}</span>
                  <span>
                    {t.seed} #{seed}: {plan.cars.length} {t.mode.car}, {planes} {t.mode.plane}, {trains} {t.mode.train}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* controls (the template's e-mail bar) */}
          <div className="tile cp-bar">
            <span className="cp-bar-label">{t.barLabel}</span>
            <div className="pill-field">
              <span>{t.seats}</span>
              <div className="seg" role="group" aria-label={t.seats}>
                {[4, 5].map((n) => (
                  <button key={n} className={n === seats ? "on" : ""} onClick={() => setSeats(n)} aria-pressed={n === seats}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-grad" onClick={() => setSeed((s) => s + 1)}>
              <Shuffle size={16} aria-hidden /> {t.newData}
            </button>
          </div>

          {/* counts */}
          <Reveal as="div" className="cp-counts">
            <div className="count c-car">
              <strong>{plan.count.car}</strong>
              <span>{t.byCar}</span>
            </div>
            <div className="count c-tram">
              <strong>{plan.count.tram}</strong>
              <span>{t.byTram}</span>
            </div>
            <div className="count c-taxi">
              <strong>{plan.count.taxi}</strong>
              <span>{t.byTaxi}</span>
            </div>
          </Reveal>

          {/* cars */}
          <Reveal id="cars" className="tile">
            <h2 className="tile-title">{t.carsH}</h2>
            <p className="tile-note">{t.carsSub}</p>
            <p className="tile-note drag-hint">{t.dragHint}</p>
            <div className="plan-grid">
              {plan.cars.map((c) => (
                <article key={c.id} className="pcard">
                  <div className="pcard-head">
                    <h3>{t.car} {c.id}</h3>
                    <span className="pcard-fill">{seatMap[c.id].filter(Boolean).length}/{seats}</span>
                  </div>
                  <CarMap carId={c.id} slots={seatMap[c.id].map((id) => (id ? byId[id] : null))} dnd={dnd} pick={pick} t={t} />
                </article>
              ))}
            </div>
          </Reveal>

          {/* tram */}
          <Reveal id="tram" className="tile">
            <h2 className="tile-title">{t.tramH}</h2>
            <p className="tile-note">{t.tramSub}</p>
            {plan.tramGroups.length ? (
              <div className="plan-grid">
                {plan.tramGroups.map((g) => (
                  <article key={g.id} className="pcard">
                    <div className="pcard-head">
                      <h3>{t.group} {g.id}</h3>
                      <span className="pcard-fill">{g.members.length}/{GROUP_TICKET_MAX}</span>
                    </div>
                    <ul>
                      {g.members.map((p) => (
                        <Person
                          key={p.id}
                          p={p}
                          badge={
                            p.id === g.buyer.id ? (
                              <span className="badge"><Ticket size={12} aria-hidden /> {t.buyer}</span>
                            ) : null
                          }
                        />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <p className="tile-note">{t.nothing}</p>
            )}
          </Reveal>

          {/* taxi */}
          <Reveal id="taxi" className="tile">
            <h2 className="tile-title">{t.taxiH}</h2>
            <p className="tile-note">{t.taxiSub}</p>
            {plan.taxis.length ? (
              <div className="plan-grid">
                {plan.taxis.map((x) => (
                  <article key={x.id} className="pcard">
                    <div className="pcard-head">
                      <h3>{t.taxi} {x.id}</h3>
                      <span className="pcard-fill">{x.from === "FRA" ? t.fromFRA : t.fromHBF}</span>
                    </div>
                    <ul>
                      {x.members.map((p) => (
                        <Person key={p.id} p={p} />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <p className="tile-note">{t.nothing}</p>
            )}
          </Reveal>

          {/* all persons */}
          <Reveal id="all" className="tile">
            <h2 className="tile-title">{t.allH}</h2>
            <div className="cp-filter" role="group">
              {[
                ["all", t.filterAll],
                ["car", t.car],
                ["driver", t.driver],
                ["tram", "Tram"],
                ["taxi", t.taxi],
              ].map(([k, label]) => (
                <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} aria-pressed={filter === k}>
                  {label}
                </button>
              ))}
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t.name}</th>
                    <th>{t.start}</th>
                    <th>{t.way}</th>
                    <th>{t.assign}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const a = assignment.get(p.id);
                    return (
                      <tr key={p.id}>
                        <td data-label="#">{p.id}</td>
                        <td data-label={t.name}>{p.name}</td>
                        <td data-label={t.start}>{p.region}</td>
                        <td data-label={t.way}>{t.mode[p.mode]}</td>
                        <td data-label={t.assign}>
                          <span className="assign">
                            <span className={`pill ${a.kind}`}>{a.label}</span>
                            {a.role ? <span className="role"> · {a.role}</span> : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* rules (the template's benefits block) */}
          <Reveal className="tile">
            <div className="rules">
              <div>
                <h2 className="tile-title">{t.ruleH}</h2>
                <p className="tile-note">{t.ruleSub}</p>
              </div>
              <div className="rule-list">
                {t.rules.map((r, i) => (
                  <div key={r} className="rule">
                    <span className="tick" style={{ background: RULE_GRADS[i % RULE_GRADS.length] }}>
                      <Check size={16} strokeWidth={3} aria-hidden />
                    </span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* dark closing tile */}
          <Reveal className="tile dark">
            <h2>{t.darkH}</h2>
            <p>{EVENT.venue} · {EVENT.address}</p>
            <button className="btn-grad" onClick={() => setSeed((s) => s + 1)}>
              <Shuffle size={16} aria-hidden /> {t.newData}
            </button>
            <small>{t.demo}</small>
          </Reveal>

          <footer className="tile cp-foot">
            <div className="foot-top">
              <div className="foot-brand">
                <img className="cp-logo foot" src={logo} alt="alseda Consulting" />
              </div>
              <nav className="foot-links">
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
            </div>
            <div className="foot-bottom">
              <span>
                © {new Date().getFullYear()} {t.rights}
              </span>
            </div>
          </footer>
        </div>
        </div>
      </div>
    </div>
  );
}
