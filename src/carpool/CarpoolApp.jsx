import { useLang, loadState, docReducer, initialDoc, loadLayouts, LAYOUT_STORE, STORE, structKeyOf, isDriverPos, sameOrder, SECTION_KEYS } from "./state.js";
import { TEXT } from "./text.js";
import React, { useMemo, useReducer, useState, useRef, useEffect } from "react";
import { LEGS, reconcileLayout, planLeg, baseLayout, tagOf, fixBuyers, copyLayoutToLeg, newBoxId, newPerson, nextName, parseRoster, defaultPersons, DEFAULT_LIMITS, applyCounts } from "./planner.js";
import { tagColors } from "./tags.js";
import { useSeatDrag, TagCtx } from "./Seats.jsx";
import { computeChecks, newRule } from "./checks.js";
import { buildCards, copyText } from "./share.js";
import { EVENT } from "../agenda.js";
import { ListChecks, Car, Train, CarTaxiFront, Users, MessageSquareText, Check, Download } from "lucide-react";
import { SectionLeg, SectionPlan, SectionCounts, SectionChecks, SectionCars, SectionTram, SectionTaxi, SectionPeople, SectionCards } from "./Sections.jsx";
import { ConfirmRemove, RulesModal, LayoutBar, Navbar, Drawer, SiteFooter } from "./Shell.jsx";
import photo from "../assets/photo-1.webp";
import { MoveBar, Reveal } from "./Controls.jsx";
import { RULE_GRADS } from "./RuleRow.jsx";

export default function CarpoolApp() {
  const [lang, setLang] = useLang();
  const t = TEXT[lang];
  const saved = useMemo(loadState, []);
  const [hist, dispatch] = useReducer(docReducer, null, () => ({ doc: initialDoc(saved), past: [], future: [] }));
  const { persons, restBy, groupBy, limits, edits, rules } = hist.doc;
  const setField = (key) => (v) =>
    dispatch({ type: "set", fn: (d) => { const nv = typeof v === "function" ? v(d[key]) : v; return nv === d[key] ? d : { ...d, [key]: nv }; } });
  const setPersons = setField("persons");
  const setRestBy = setField("restBy");
  const setGroupBy = setField("groupBy");
  const setLimits = setField("limits");
  const setEdits = setField("edits");
  const setRules = setField("rules");
  const setDoc = (patch) => dispatch({ type: "set", fn: (d) => ({ ...d, ...patch }) });
  const [leg, setLeg] = useState(saved?.leg === 1 ? 1 : 0);
  const [filter, setFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [newName, setNewName] = useState("");
  const [picked, setPicked] = useState(null); // { car: boxId, idx } of the person chosen by tapping
  const [note, setNote] = useState(""); // short confirmation ("copied", "saved")
  const fileRef = useRef(null);
  const planRef = useRef(null);
  const [layoutState, setLayoutState] = useState(loadLayouts); // { variants, activeId, order }
  const [layoutEdit, setLayoutEdit] = useState(false); // show the move bars
  const [rulesOpen, setRulesOpen] = useState(false); // popup with the custom rules
  const [renaming, setRenaming] = useState(null); // id of the variant whose name is being edited in the bar
  const [drawerOpen, setDrawerOpen] = useState(false); // side menu on tablet / phone
  const [drawerClosing, setDrawerClosing] = useState(false); // true while it slides out
  const [delAsk, setDelAsk] = useState(null); // person id waiting for the delete confirmation
  const [openRows, setOpenRows] = useState({}); // person id -> true when the phone card is open
  const drawerTimer = useRef(0);
  const closeDrawerRef = useRef(() => {});
  const DRAWER_MS = 320;
  const openDrawer = () => {
    clearTimeout(drawerTimer.current);
    setDrawerClosing(false);
    setDrawerOpen(true);
  };
  // slides out first, removes the menu afterwards; `after` runs once it is gone
  const closeDrawer = (after) => {
    if (drawerClosing) return;
    setDrawerClosing(true);
    drawerTimer.current = setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
      // after Esc the menu button would keep its keyboard focus ring and look stuck on hover
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (typeof after === "function") after();
    }, DRAWER_MS);
  };
  closeDrawerRef.current = closeDrawer;
  const [scrolled, setScrolled] = useState(false); // navbar gets a shadow once the page is scrolled
  const [activeSec, setActiveSec] = useState(""); // section that is in view (highlighted in the menus)
  const [layoutPast, setLayoutPast] = useState([]); // earlier orders of this editing session (for the undo button)
  // while the popup is open the page behind it does not scroll (the popup itself does)
  useEffect(() => {
    if (!rulesOpen && !drawerOpen) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const esc = (e) => {
      if (e.key !== "Escape") return;
      // an open dropdown is the top layer: Esc closes that one first
      if (document.querySelector(".select__trigger[data-popup-open]")) return;
      setRulesOpen(false);
      setDelAsk(null);
      closeDrawerRef.current();
    };
    window.addEventListener("keydown", esc);
    return () => {
      html.style.overflow = prev[0];
      document.body.style.overflow = prev[1];
      window.removeEventListener("keydown", esc);
    };
  }, [rulesOpen, drawerOpen]);
  // shadow under the navbar and the section that is currently in view
  useEffect(() => {
    const ids = ["checks", "cars", "tram", "taxi", "all", "cards"];
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
      let cur = "";
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      });
      setActiveSec(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORE, JSON.stringify(layoutState));
    } catch {}
  }, [layoutState]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...hist.doc, leg }));
    } catch {}
  }, [hist.doc, leg]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 2200);
    return () => clearTimeout(id);
  }, [note]);
  const undo = () => {
    dispatch({ type: "undo" });
    setPicked(null);
  };
  const redo = () => {
    dispatch({ type: "redo" });
    setPicked(null);
  };
  useEffect(() => {
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // layout of both legs: planned automatically, then the manual edits of that leg merged in
  const layouts = useMemo(
    () =>
      LEGS.map((_, l) => {
        const key = structKeyOf(persons, l, restBy, groupBy);
        const e = edits[l];
        if (e && e.key === key && e.layout) {
          const riders = persons.filter((p) => p.legs[l] && !p.car).map((p) => p.id);
          return { key, layout: reconcileLayout(e.layout, riders, limits, restBy), away: persons.filter((p) => !p.legs[l]).length };
        }
        const plan = planLeg(persons, l, restBy, limits, groupBy);
        return { key, layout: baseLayout(plan, limits), away: plan.away };
      }),
    [persons, restBy, limits, groupBy, edits]
  );
  const { key: planKey, layout, away } = layouts[leg];
  const { boxes, order, buyers } = layout;
  const times = layout.times || {};
  const L = LEGS[leg];
  const from = L.from.name[lang];
  const to = L.to.name[lang];

  useEffect(() => setPicked(null), [planKey, leg]);
  // one dialog at a time: opening any dialog drops a half-finished selection
  useEffect(() => { if (delAsk || rulesOpen || drawerOpen) setPicked(null); }, [delAsk, rulesOpen, drawerOpen]);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  const byId = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);

  // team / language colours (the table also colours by team while no grouping is chosen)
  const filterBy = groupBy === "none" ? "team" : groupBy;
  const tagInfo = useMemo(() => tagColors(persons, filterBy), [persons, filterBy]);
  const tagCtx = useMemo(
    () => ({ by: groupBy, of: (p) => tagOf(p, groupBy), color: tagInfo.color, title: (p) => [p.team, p.lang].filter(Boolean).join(" · ") }),
    [groupBy, tagInfo]
  );
  useEffect(() => setTagFilter(null), [groupBy]);

  // change the layout of the chosen leg by hand (fn gets a copy)
  const editLayout = (fn) => {
    const copy = {
      boxes: Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, [...v]])),
      order: { cars: [...order.cars], groups: [...order.groups], taxis: [...order.taxis] },
      buyers: { ...buyers },
      times: { ...times },
    };
    setEdits((prev) => ({ ...prev, [leg]: { key: planKey, layout: fixBuyers(fn(copy) || copy) } }));
  };

  // move a person to a free place or swap two people (cars, tram groups, taxis); drivers never move
  const swapSeats = (a, b) => {
    if (isDriverPos(a) || isDriverPos(b)) return;
    editLayout((l) => {
      const tmp = l.boxes[a.car][a.idx];
      l.boxes[a.car][a.idx] = l.boxes[b.car][b.idx];
      l.boxes[b.car][b.idx] = tmp;
    });
  };
  const setTime = (id, value) =>
    editLayout((l) => {
      if (!value || value === L.time) delete l.times[id];
      else l.times[id] = value;
    });
  // leg 2 starts from the cars, groups and taxis of leg 1 (can be undone)
  const copyLeg = () => {
    setEdits((prev) => ({ ...prev, 1: { key: structKeyOf(persons, 1, restBy, groupBy), layout: copyLayoutToLeg(layouts[0].layout, persons, 1) } }));
    if (leg !== 1) setLeg(1);
    setNote(t.legCopied);
  };
  const setBuyer = (gid, pid) => editLayout((l) => void (l.buyers[gid] = pid));
  const addBox = (kind) =>
    editLayout((l) => {
      const id = newBoxId(l, kind === "groups" ? "g" : "t");
      l.boxes[id] = Array(kind === "groups" ? limits.groupMax : limits.taxiSeats).fill(null);
      l.order[kind].push(id);
    });
  // set the number of tram groups: everybody in a group is spread evenly over the new number
  const setGroupCount = (n) =>
    editLayout((l) => {
      const members = l.order.groups.flatMap((g) => l.boxes[g].filter(Boolean));
      const total = members.length;
      const ids = l.order.groups.slice(0, n);
      l.order.groups.slice(n).forEach((g) => delete l.boxes[g]);
      while (ids.length < n) ids.push(newBoxId({ boxes: { ...l.boxes, ...Object.fromEntries(ids.map((i) => [i, 0])) } }, "g"));
      l.order.groups = ids;
      ids.forEach((g, i) => {
        const size = Math.floor(total / n) + (i < total % n ? 1 : 0);
        const mine = members.splice(0, size);
        l.boxes[g] = [...mine, ...Array(limits.groupMax - mine.length).fill(null)];
      });
    });
  const removeBox = (kind, id) =>
    editLayout((l) => {
      if (l.boxes[id].some(Boolean)) return;
      delete l.boxes[id];
      l.order[kind] = l.order[kind].filter((x) => x !== id);
    });
  const dnd = useSeatDrag(swapSeats);
  // a drag cancels a tap selection; the click that ends a drag on its own seat must not select again
  const lastDrag = useRef(0);
  useEffect(() => {
    if (!dnd.drag) return;
    setPicked(null);
    return () => {
      lastDrag.current = Date.now();
    };
  }, [!!dnd.drag]);

  // tap a person, then a place: move or swap. Tapping the chosen one again cancels. Driver seats do nothing.
  const onTap = (pos, hasPerson) => {
    if (Date.now() - lastDrag.current < 150) return;
    if (!picked) {
      if (hasPerson && !isDriverPos(pos)) setPicked(pos);
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
  const pickedPerson = picked ? byId[boxes[picked.car]?.[picked.idx]] : null;
  const filled = (id) => boxes[id].filter(Boolean).length;

  // ---------- roster actions ----------
  const patch = (id, change) => setPersons((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const toggleLeg = (p, i) => patch(p.id, { legs: p.legs.map((v, j) => (j === i ? !v : v)) });
  // while the delete dialog is open the page behind it must not scroll
  useEffect(() => {
    if (!delAsk) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [delAsk]);
  const removePerson = (id) => setDelAsk(id); // asks first, see the dialog below
  const removeNow = () => {
    setPersons((ps) => ps.filter((p) => p.id !== delAsk));
    setDelAsk(null);
  };
  const addPerson = (name) => setPersons((ps) => [...ps, newPerson(name || nextName(ps))]);
  const setCount = (n) =>
    setPersons((ps) => {
      let list = [...ps];
      while (list.length < n) list.push(newPerson(nextName(list)));
      while (list.length > n) {
        // drop the last person without a car first
        const i = list.map((p) => p.car).lastIndexOf(false);
        list.splice(i === -1 ? list.length - 1 : i, 1);
      }
      return list;
    });
  const submitAdd = (e) => {
    e.preventDefault();
    addPerson(newName.trim());
    setNewName("");
  };
  const loadFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const apply = (text) => {
      const list = parseRoster(text);
      if (!list.length) return window.alert(t.csvEmpty);
      if (window.confirm(t.replaceAsk(list.length))) {
        // rules about named people no longer fit a new list
        setDoc({ persons: list, edits: {}, rules: rules.filter((r) => r.type !== "pair" && r.type !== "person") });
      }
    };
    // UTF-8 first; a German Excel saves "CSV" as windows-1252 (ä, ö, ü, ß are not valid UTF-8): then read it again that way
    const r = new FileReader();
    r.onload = () => {
      const utf8 = String(r.result);
      if (!utf8.includes("\uFFFD")) return apply(utf8);
      const r2 = new FileReader();
      r2.onload = () => apply(String(r2.result));
      r2.readAsText(f, "windows-1252");
    };
    r.readAsText(f, "utf-8");
  };
  const resetData = () => {
    if (!window.confirm(t.resetAsk)) return;
    setDoc({ persons: defaultPersons(), edits: {}, limits: DEFAULT_LIMITS, restBy: "tram", groupBy: "none", rules: [] });
  };

  // every placed person of a layout, in plan order, with label and role (assignment table + export)
  const entriesOf = (lay) => {
    const out = [];
    lay.order.cars.forEach((id, n) =>
      lay.boxes[id].forEach((pid, i) => pid && out.push({ pid, kind: "car", label: `${t.car} ${n + 1}`, role: i === 0 ? t.driver : "" }))
    );
    lay.order.groups.forEach((id, n) =>
      lay.boxes[id].forEach((pid) => pid && out.push({ pid, kind: "tram", label: `${t.group} ${n + 1}`, role: lay.buyers[id] === pid ? t.buyer : "" }))
    );
    lay.order.taxis.forEach((id, n) =>
      lay.boxes[id].forEach((pid) => pid && out.push({ pid, kind: "taxi", label: `${t.taxi} ${n + 1}`, role: "" }))
    );
    return out;
  };
  const assignment = useMemo(() => new Map(entriesOf(layout).map((e) => [e.pid, e])), [layout, t]);
  const count = useMemo(() => {
    const c = { car: 0, tram: 0, taxi: 0 };
    entriesOf(layout).forEach((e) => c[e.kind]++);
    return c;
  }, [layout, t]);
  const checks = useMemo(() => computeChecks({ persons, layouts, groupBy, limits, rules }), [persons, layouts, groupBy, limits, rules]);
  const addRule = (type) => setRules((rs) => [...rs, newRule(type)]);
  const changeRule = (r) => setRules((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  const removeRule = (id) => setRules((rs) => rs.filter((x) => x.id !== id));
  const teamList = [...new Set(persons.map((p) => p.team).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const CHECK_TARGET = { noPeople: "all", carNotThere: "all", emptyCar: "cars", freeSeats: "cars", mixed: "cars", smallGroup: "tram", lonelyTaxi: "taxi" };
  const goToCheck = (c) => {
    const kindTarget = { car: "cars", group: "tram", taxi: "taxi" };
    const ruleTarget = c.args.type === "person" || c.args.type === "note" ? (c.args.rule === "noTaxi" ? "taxi" : c.args.rule === "noTram" ? "tram" : c.args.rule === "notAlone" ? kindTarget[c.args.kind] || "cars" : "cars") : "cars";
    const target = c.code === "emptyBox" ? (c.args.kind === "group" ? "tram" : "taxi") : c.code === "rule" ? ruleTarget : CHECK_TARGET[c.code] || "all";
    if (c.leg !== leg) setLeg(c.leg);
    // wait one tick so the other leg is rendered before scrolling
    setTimeout(() => {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }, c.leg !== leg ? 80 : 0);
  };
  const warns = checks.filter((c) => c.level === "warn").length;
  const legCards = useMemo(() => LEGS.map((lg, l) => ({ lg, l, cards: buildCards(layouts[l].layout, byId, t) })), [layouts, byId, t]);
  const legHead = (lg, l) => `${t.leg} ${l + 1} · ${lg.time} ${t.oclock} · ${lg.from.name[lang]} → ${lg.to.name[lang]}`.replace("  ", " ");
  const copyCards = async (text, label) => setNote((await copyText(text)) ? label : "");
  const savePlan = () => {
    const blob = new Blob([JSON.stringify({ app: "carpool", version: 1, saved: new Date().toISOString(), doc: hist.doc }, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carpool-plan-${EVENT.date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(t.planSaved);
  };
  const loadPlan = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.xlsx$/i.test(f.name)) {
      (async () => {
        try {
          const { readPlanFromExcel } = await import("./excelImport.js");
          const res = await readPlanFromExcel(f, { legs: LEGS, limits, keyOf: (ps, l) => structKeyOf(ps, l, restBy, groupBy) });
          // rules about named people no longer fit the new list
          if (window.confirm(t.planAsk)) setDoc({ persons: res.persons, edits: res.edits, rules: rules.filter((r) => r.type !== "pair" && r.type !== "person") });
        } catch (err) {
          console.error(err);
          window.alert(t.planBad);
        }
      })();
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        const ps = d?.doc?.persons;
        if (d?.app !== "carpool" || !Array.isArray(ps) || !ps.every((p) => p && p.id && p.name && Array.isArray(p.legs))) throw new Error("bad");
        if (window.confirm(t.planAsk)) dispatch({ type: "set", fn: () => initialDoc(d.doc) });
      } catch {
        window.alert(t.planBad);
      }
    };
    r.readAsText(f, "utf-8");
  };
  const groupPeople = order.groups.reduce((n, id) => n + filled(id), 0);
  // how many go by car / tram / taxi: the mode that absorbs the change is the one the rest travels by
  const total = count.car + count.tram + count.taxi;
  const carMin = order.cars.length;
  const carMax = order.cars.reduce((n, id) => n + boxes[id].length, 0);
  const setCounts = (mode, v) => {
    let { car, tram, taxi } = count;
    const rest = () => total - car;
    if (mode === "car") {
      car = v;
      if (restBy === "taxi") {
        taxi = rest() - tram;
        if (taxi < 0) { taxi = 0; tram = rest(); }
      } else {
        tram = rest() - taxi;
        if (tram < 0) { tram = 0; taxi = rest(); }
      }
    } else if (mode === "tram") {
      tram = v;
      taxi = rest() - tram;
    } else {
      taxi = v;
      tram = rest() - taxi;
    }
    editLayout((l) => applyCounts(l, { car, tram, taxi }, limits));
  };
  const tickets = order.groups.filter((id) => filled(id) > 0).length;

  // the plan as an Excel workbook (overview, one sheet per leg, people with filters, hints)
  const exportPlan = async () => {
    try {
      const { buildWorkbook } = await import("./excel.js");
      const blob = await buildWorkbook({ persons, layouts, legs: LEGS, lang, t, checks, date: eventDateShort });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transfer-plan-${EVENT.date}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      window.alert(t.exportFailed);
    }
  };

  const eventDateShort = new Date(EVENT.date + "T12:00:00").toLocaleDateString(({ de: "de-DE", en: "en-GB", ru: "ru-RU" })[lang]);
  const eventDate = new Date(EVENT.date + "T12:00:00").toLocaleDateString(({ de: "de-DE", en: "en-GB", ru: "ru-RU" })[lang], { day: "numeric", month: "long", year: "numeric" });
  const onLeg = persons.length - away;
  const search = newName.trim().toLowerCase(); // the name box is also the search box
  const rows = persons.filter((p) => {
    const a = assignment.get(p.id);
    if (search && !p.name.toLowerCase().includes(search)) return false;
    if (tagFilter && tagOf(p, filterBy) !== tagFilter) return false;
    if (filter === "all") return true;
    if (filter === "away") return !p.legs[leg];
    if (filter === "driver") return p.car && p.legs[leg];
    return a?.kind === filter;
  });

  // section order + variants
  const { variants, activeId, order: sectionOrder } = layoutState;
  const activeVariant = variants.find((v) => v.id === activeId) || null;
  const layoutDirty = !sameOrder(sectionOrder, activeVariant ? activeVariant.order : SECTION_KEYS);
  const setOrder = (order) => setLayoutState((s) => ({ ...s, order }));
  const moveSection = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sectionOrder.length) return;
    const o = [...sectionOrder];
    [o[i], o[j]] = [o[j], o[i]];
    setLayoutPast((p) => [...p.slice(-30), sectionOrder]);
    setOrder(o);
  };
  const undoOrder = () => {
    if (!layoutPast.length) return;
    const prev = layoutPast[layoutPast.length - 1];
    setLayoutPast((p) => p.slice(0, -1));
    setOrder(prev);
  };
  const applyVariant = (id) => {
    setLayoutPast((p) => [...p.slice(-30), sectionOrder]);
    setLayoutState((s) => {
      const v = s.variants.find((x) => x.id === id);
      return { ...s, activeId: v ? v.id : null, order: v ? v.order : SECTION_KEYS };
    });
  };
  const saveVariantAs = () => {
    // no question: the variant is named "Variante N" (next free number)
    const used = new Set(variants.map((v) => v.name));
    let n = variants.length + 1;
    while (used.has(`${t.variant} ${n}`)) n++;
    const name = `${t.variant} ${n}`;
    const id = `v${Date.now().toString(36)}`;
    setLayoutState((s) => ({ ...s, variants: [...s.variants, { id, name, order: s.order }], activeId: id }));
    setRenaming(id);
  };
  const updateVariant = () => {
    if (!activeVariant) return;
    setLayoutState((s) => ({ ...s, variants: s.variants.map((v) => (v.id === s.activeId ? { ...v, order: s.order } : v)) }));
    setNote(t.variantSaved);
  };
  const renameVariant = (id, name) => {
    const n = name.trim();
    if (n) setLayoutState((s) => ({ ...s, variants: s.variants.map((v) => (v.id === id ? { ...v, name: n } : v)) }));
    setRenaming(null);
  };
  const deleteVariant = () => {
    if (!activeVariant) return;
    setLayoutState((s) => ({ ...s, variants: s.variants.filter((v) => v.id !== s.activeId), activeId: null }));
  };

  const SECTIONS = {
    checks: { id: "checks", icon: ListChecks, label: t.checksH, nav: t.navChecks, count: checks.length },
    cars: { id: "cars", icon: Car, label: t.carsH, nav: t.navCars, count: count.car },
    tram: { id: "tram", icon: Train, label: t.tramH, nav: t.navTram, count: count.tram },
    taxi: { id: "taxi", icon: CarTaxiFront, label: t.taxiH, nav: t.navTaxi, count: count.taxi },
    people: { id: "all", icon: Users, label: t.allH, nav: t.navAll, count: persons.length },
    cards: { id: "cards", icon: MessageSquareText, label: t.cardsH, nav: t.navCards, count: legCards[leg].cards.length },
  };
  const sectionLinks = sectionOrder.map((k) => SECTIONS[k]).filter(Boolean);

  const blocks = {
    leg: (
            <SectionLeg
        t={t}
        leg={leg}
        setLeg={setLeg}
        restBy={restBy}
        setRestBy={setRestBy}
        exportPlan={exportPlan}
      />
    ),
    plan: (
            <SectionPlan
        t={t}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        undo={undo}
        hist={hist}
        redo={redo}
        savePlan={savePlan}
        planRef={planRef}
        copyLeg={copyLeg}
        loadPlan={loadPlan}
      />
    ),
    counts: (
            <SectionCounts
        count={count}
        t={t}
        carMin={carMin}
        carMax={carMax}
        total={total}
        setCounts={setCounts}
      />
    ),
    checks: (
            <SectionChecks
        t={t}
        warns={warns}
        checks={checks}
        setRulesOpen={setRulesOpen}
        rules={rules}
        goToCheck={goToCheck}
      />
    ),
    cars: (
            <SectionCars
        t={t}
        count={count}
        order={order}
        times={times}
        L={L}
        setTime={setTime}
        filled={filled}
        boxes={boxes}
        byId={byId}
        dnd={dnd}
        pick={pick}
      />
    ),
    tram: (
            <SectionTram
        t={t}
        count={count}
        from={from}
        order={order}
        groupPeople={groupPeople}
        limits={limits}
        setGroupCount={setGroupCount}
        setLimits={setLimits}
        tickets={tickets}
        times={times}
        L={L}
        setTime={setTime}
        filled={filled}
        boxes={boxes}
        removeBox={removeBox}
        byId={byId}
        dnd={dnd}
        pick={pick}
        buyers={buyers}
        setBuyer={setBuyer}
      />
    ),
    taxi: (
            <SectionTaxi
        t={t}
        count={count}
        limits={limits}
        setLimits={setLimits}
        addBox={addBox}
        order={order}
        times={times}
        L={L}
        setTime={setTime}
        filled={filled}
        boxes={boxes}
        removeBox={removeBox}
        byId={byId}
        dnd={dnd}
        pick={pick}
      />
    ),
    people: (
            <SectionPeople
        t={t}
        rows={rows}
        setCount={setCount}
        persons={persons}
        submitAdd={submitAdd}
        newName={newName}
        setNewName={setNewName}
        fileRef={fileRef}
        loadFile={loadFile}
        resetData={resetData}
        filter={filter}
        setFilter={setFilter}
        tagInfo={tagInfo}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        filterBy={filterBy}
        assignment={assignment}
        leg={leg}
        openRows={openRows}
        patch={patch}
        toggleLeg={toggleLeg}
        setOpenRows={setOpenRows}
        removePerson={removePerson}
      />
    ),
    cards: (
            <SectionCards
        t={t}
        copyCards={copyCards}
        legCards={legCards}
        leg={leg}
        legHead={legHead}
        L={L}
      />
    ),
  };

  return (
    <TagCtx.Provider value={tagCtx}>
    <div className={`cp${dnd.drag ? " dragging" : ""}${picked ? " picking" : ""}${layoutEdit ? " layout-editing" : ""}`}>
      {note ? (
        <div className="toast" role="status">
          {note}
        </div>
      ) : null}
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
      {delAsk && byId[delAsk] ? (
        <ConfirmRemove setDelAsk={setDelAsk} t={t} byId={byId} delAsk={delAsk} removeNow={removeNow} />
      ) : null}
      {rulesOpen ? (
        <RulesModal setRulesOpen={setRulesOpen} t={t} addRule={addRule} rules={rules} persons={persons} teamList={teamList} changeRule={changeRule} removeRule={removeRule} />
      ) : null}
      {layoutEdit ? (
        <LayoutBar t={t} variants={variants} renaming={renaming} renameVariant={renameVariant} setRenaming={setRenaming} activeId={activeId} applyVariant={applyVariant} layoutDirty={layoutDirty} undoOrder={undoOrder} layoutPast={layoutPast} activeVariant={activeVariant} updateVariant={updateVariant} saveVariantAs={saveVariantAs} deleteVariant={deleteVariant} setLayoutEdit={setLayoutEdit} />
      ) : null}
      <Navbar scrolled={scrolled} t={t} sectionLinks={sectionLinks} activeSec={activeSec} checks={checks} warns={warns} layoutEdit={layoutEdit} setLayoutEdit={setLayoutEdit} lang={lang} setLang={setLang} openDrawer={openDrawer} />
      {drawerOpen ? (
        <Drawer drawerClosing={drawerClosing} closeDrawer={closeDrawer} t={t} sectionLinks={sectionLinks} activeSec={activeSec} setLayoutEdit={setLayoutEdit} setRulesOpen={setRulesOpen} exportPlan={exportPlan} lang={lang} setLang={setLang} />
      ) : null}

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
                  <p className="holo-label">
                    {t.leg} {leg + 1} · {L.time} {t.oclock}
                  </p>
                  <p className="holo-venue">
                    {from} → {to}
                  </p>
                  <p className="holo-addr">{L.to.addr}</p>
                </div>
                <div className="hero-holo green">
                  <dl className="holo-facts">
                    <div>
                      <dt>{t.date}</dt>
                      <dd>{eventDate}</dd>
                    </div>
                    <div>
                      <dt>{t.depart}</dt>
                      <dd>{L.time} {t.oclock}</dd>
                    </div>
                    <div>
                      <dt>{t.persons}</dt>
                      <dd>{onLeg}</dd>
                    </div>
                  </dl>
                  <p className="holo-demo">
                    <span>{t.demo}</span>
                  </p>
                </div>
              </div>
            </div>

            {sectionOrder.map((k, i) => (
              <React.Fragment key={k}>
                {layoutEdit ? (
                  <MoveBar
                    label={t.sections[k]}
                    first={i === 0}
                    last={i === sectionOrder.length - 1}
                    onUp={() => moveSection(i, -1)}
                    onDown={() => moveSection(i, 1)}
                    t={t}
                  />
                ) : null}
                {blocks[k]}
              </React.Fragment>
            ))}

            {/* rules (the template's benefits block) */}
            <Reveal className="tile">
              <div className="rules">
                <div>
                  <h2 className="tile-title">{t.ruleH}</h2>
                  <p className="tile-note">{t.ruleSub}</p>
                </div>
                <div className="rule-list">
                  {t.rules.map((r, i) => (
                    <div key={i} className="rule">
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
              <h2>{t.darkH(onLeg)}</h2>
              <p>{from} → {to}</p>
              <button className="btn-grad" onClick={exportPlan}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
              <small>{t.demo}</small>
            </Reveal>

            <SiteFooter t={t} />
          </div>
        </div>
      </div>
    </div>
    </TagCtx.Provider>
  );
}
