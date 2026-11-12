// cards (one per car / group / taxi) and plain-text messages for a leg
export function buildCards(layout, byId, t) {
  const names = (ids) => ids.filter(Boolean).map((id) => byId[id].name);
  const cards = [];
  layout.order.cars.forEach((id, n) => {
    const slots = layout.boxes[id];
    cards.push({ id, kind: "car", title: `${t.car} ${n + 1}`, lead: [t.driver, byId[slots[0]].name], people: names(slots.slice(1)) });
  });
  layout.order.groups.forEach((id, n) => {
    const m = layout.boxes[id].filter(Boolean);
    if (!m.length) return;
    cards.push({ id, kind: "tram", title: `${t.group} ${n + 1}`, lead: [t.buyer, byId[layout.buyers[id]].name], people: names(m.filter((x) => x !== layout.buyers[id])) });
  });
  layout.order.taxis.forEach((id, n) => {
    const m = layout.boxes[id].filter(Boolean);
    if (m.length) cards.push({ id, kind: "taxi", title: `${t.taxi} ${n + 1}`, lead: null, people: names(m) });
  });
  return cards;
}

export const cardText = (c, head, t) =>
  [head, c.title, c.lead ? `${c.lead[0]}: ${c.lead[1]}` : null, `${c.kind === "car" ? t.passengers : t.members}: ${c.people.join(", ") || "–"}`]
    .filter(Boolean)
    .join("\n");

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}
