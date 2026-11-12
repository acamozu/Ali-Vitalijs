import { MIN_TICKET_GROUP, tagOf } from "./planner.js";

// plan checks per leg. Each hint: { level: "warn" | "info", leg, code, args }
export function computeChecks({ persons, layouts, groupBy, limits }) {
  const out = [];
  const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
  const minGroup = Math.min(MIN_TICKET_GROUP, limits.groupMax);
  layouts.forEach(({ layout: l }, leg) => {
    const add = (level, code, args = {}) => out.push({ level, leg, code, args });
    const size = (id) => l.boxes[id].filter(Boolean).length;
    const active = persons.filter((p) => p.legs[leg]).length;
    if (!active) return add("warn", "noPeople");

    const carFree = l.order.cars.reduce((n, id) => n + l.boxes[id].length - size(id), 0);
    const onFoot = l.order.groups.reduce((n, id) => n + size(id), 0) + l.order.taxis.reduce((n, id) => n + size(id), 0);
    l.order.cars.forEach((id, n) => {
      if (size(id) === 1 && onFoot > 0) add("warn", "emptyCar", { n: n + 1 });
    });
    if (carFree > 0 && onFoot > 0) add("info", "freeSeats", { free: carFree, others: onFoot });

    l.order.groups.forEach((id, n) => {
      const s = size(id);
      if (s === 0) add("info", "emptyBox", { kind: "group", n: n + 1 });
      else if (s < minGroup) add("warn", "smallGroup", { n: n + 1, size: s });
    });
    const taxiFree = l.order.taxis.reduce((n, id) => n + l.boxes[id].length - size(id), 0);
    l.order.taxis.forEach((id, n) => {
      const s = size(id);
      if (s === 0) add("info", "emptyBox", { kind: "taxi", n: n + 1 });
      else if (s === 1 && taxiFree - (l.boxes[id].length - 1) >= 1) add("warn", "lonelyTaxi", { n: n + 1 });
    });

    if (groupBy !== "none") {
      // one line per leg: how many cars / groups / taxis are not uniform
      const ids = [...l.order.cars, ...l.order.groups, ...l.order.taxis].filter((id) => size(id) > 0);
      const mixed = ids.filter((id) => new Set(l.boxes[id].filter(Boolean).map((pid) => tagOf(byId[pid], groupBy) || "–")).size > 1).length;
      if (mixed) add("info", "mixed", { count: mixed, total: ids.length, by: groupBy });
    }

    // the car has to be at the start of the second leg
    if (leg === 1) persons.filter((p) => p.car && p.legs[1] && !p.legs[0]).forEach((p) => add("warn", "carNotThere", { name: p.name }));
  });
  return out;
}
