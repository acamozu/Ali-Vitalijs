// Test data + carpool planner. Everything runs in the browser, all persons are fictional.

export const CAR_SEATS = 5; // driver included
export const GROUP_TICKET_MAX = 5; // RMV group day ticket: up to 5 people
export const TAXI_SEATS = 4;
export const MIN_TICKET_GROUP = 3; // a rest of 1-2 people takes a taxi instead of a group ticket

// regions around Frankfurt, ordered roughly as a ring -> distance = steps on the ring
export const REGIONS = ["Frankfurt", "Offenbach", "Hanau", "Aschaffenburg", "Darmstadt", "Mainz", "Wiesbaden", "Bad Homburg"];

const FIRST = ["Alex", "Bea", "Chris", "Dana", "Eli", "Finn", "Gina", "Hugo"];
const LAST = ["Beispiel", "Muster", "Probe", "Demo", "Testmann"];

// small seeded random generator -> same seed = same test data
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 40 test persons: 4 come by car, 3-4 by plane, the rest by train
export function generatePersons(seed, total = 40) {
  const rand = rng(seed);
  const cars = 4;
  const planes = 3 + Math.floor(rand() * 2);
  const modes = shuffle(
    [...Array(cars).fill("car"), ...Array(planes).fill("plane"), ...Array(total - cars - planes).fill("train")],
    rand
  );
  // names: every first/last combination once, in random order
  const names = shuffle(FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`)), rand);
  return modes.map((mode, i) => ({
    id: `T${String(i + 1).padStart(2, "0")}`,
    name: names[i],
    mode,
    region: mode === "plane" ? "FRA" : REGIONS[Math.floor(rand() * REGIONS.length)],
  }));
}

const dist = (a, b) => {
  const d = Math.abs(REGIONS.indexOf(a) - REGIONS.indexOf(b));
  return Math.min(d, REGIONS.length - d);
};

// carpool plan: cars first (same region first), plane group -> taxi, rest of the train people -> tram with group tickets
export function planTrip(persons, seats = CAR_SEATS) {
  const drivers = persons.filter((p) => p.mode === "car");
  const fliers = persons.filter((p) => p.mode === "plane");
  let riders = persons.filter((p) => p.mode === "train");

  const cars = drivers.map((d, i) => ({ id: i + 1, driver: d, passengers: [] }));

  // 1) every rider picks the nearest car that still has a free seat (riders of the same region first)
  const order = [...riders].sort((a, b) => a.region.localeCompare(b.region));
  const placed = new Set();
  for (const p of order) {
    const open = cars.filter((c) => c.passengers.length + 1 < seats);
    if (!open.length) break;
    const best = open.reduce((m, c) => (dist(p.region, c.driver.region) < dist(p.region, m.driver.region) ? c : m));
    best.passengers.push(p);
    placed.add(p.id);
  }
  riders = riders.filter((p) => !placed.has(p.id));

  // 2) the rest goes by tram from the main station; groups of up to 5, one ticket buyer per group
  riders.sort((a, b) => a.region.localeCompare(b.region));
  const tram = [];
  for (let i = 0; i < riders.length; i += GROUP_TICKET_MAX) tram.push(riders.slice(i, i + GROUP_TICKET_MAX));
  let hbfTaxi = [];
  if (tram.length && tram[tram.length - 1].length < MIN_TICKET_GROUP) hbfTaxi = tram.pop(); // too small for a ticket
  const tramGroups = tram.map((members, i) => ({ id: i + 1, buyer: members[0], members }));

  // 3) taxis: airport group and (if any) the small rest from the main station
  const chunk = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += TAXI_SEATS) out.push(list.slice(i, i + TAXI_SEATS));
    return out;
  };
  const taxis = [
    ...chunk(fliers).map((members) => ({ from: "FRA", members })),
    ...chunk(hbfTaxi).map((members) => ({ from: "HBF", members })),
  ].map((t, i) => ({ ...t, id: i + 1 }));

  const count = {
    car: cars.reduce((n, c) => n + 1 + c.passengers.length, 0),
    tram: tramGroups.reduce((n, g) => n + g.members.length, 0),
    taxi: taxis.reduce((n, t) => n + t.members.length, 0),
  };
  return { cars, tramGroups, taxis, count, seatsFree: cars.reduce((n, c) => n + seats - 1 - c.passengers.length, 0) };
}
