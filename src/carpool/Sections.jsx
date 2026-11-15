import { LEGS, LIMIT_RANGE, TAXI_RANGE, LANG_OPTIONS, MIN_SEATS, CAR_SEATS } from "./planner.js";
import { Download, Undo2, Redo2, Save, FolderOpen, Copy, Minus, Plus, ListPlus, TriangleAlert, Info, ArrowRight, CircleCheck, Ticket, X, Upload, RotateCcw, Car, Check, ChevronDown, Trash2 } from "lucide-react";
import { Reveal, DepartTime, Stepper } from "./Controls.jsx";
import { ruleReady } from "./checks.js";
import { CarMap, Slot } from "./Seats.jsx";
import LangSelect from "./LangSelect.jsx";
import { cardText } from "./share.js";

// The nine sections of the page (leg bar ... message cards). They were part of CarpoolApp.jsx;
// the JSX is unchanged, every value comes in as a prop of the same name.

export function SectionLeg({ t, leg, setLeg, restBy, setRestBy, exportPlan }) {
  return (
    <div className="tile cp-bar bar-leg">
              <span className="cp-bar-label">{t.leg}</span>
              <div className="pill-field">
                <div className="seg" role="group" aria-label={t.leg}>
                  {LEGS.map((lg, i) => (
                    <button key={i} className={i === leg ? "on" : ""} onClick={() => setLeg(i)} aria-pressed={i === leg}>
                      {i + 1} · {lg.time}
                    </button>
                  ))}
                </div>
                <div className="field-group">
                  <span>{t.restBy}</span>
                  <div className="seg" role="group" aria-label={t.restBy}>
                    {[
                      ["tram", t.segTram],
                      ["taxi", t.segTaxi],
                    ].map(([k, label]) => (
                      <button key={k} className={restBy === k ? "on" : ""} onClick={() => setRestBy(k)} aria-pressed={restBy === k}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn-grad" onClick={exportPlan}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
            </div>
  );
}

export function SectionPlan({ t, groupBy, setGroupBy, undo, hist, redo, savePlan, planRef, copyLeg, loadPlan }) {
  return (
    <div className="tile cp-bar bar-plan">
              <span className="cp-bar-label">{t.optionsLabel}</span>
              <div className="pill-field">
                <div className="field-group">
                <span>{t.groupBy}</span>
                <div className="seg" role="group" aria-label={t.groupBy}>
                  {[
                    ["none", t.groupNone],
                    ["team", t.groupTeam],
                    ["lang", t.groupLang],
                  ].map(([k, label]) => (
                    <button key={k} className={groupBy === k ? "on" : ""} onClick={() => setGroupBy(k)} aria-pressed={groupBy === k}>
                      {label}
                    </button>
                  ))}
                </div>
                </div>
              </div>
              <div className="bar-actions">
                <div className="bar-undo">
                  <button className="ghost icon-only" onClick={undo} disabled={!hist.past.length} aria-label={t.undo} title={`${t.undo} (Ctrl+Z)`}>
                    <Undo2 size={17} aria-hidden />
                  </button>
                  <button className="ghost icon-only" onClick={redo} disabled={!hist.future.length} aria-label={t.redo} title={`${t.redo} (Ctrl+Y)`}>
                    <Redo2 size={17} aria-hidden />
                  </button>
                </div>
                <div className="bar-files">
                  <button className="ghost" onClick={savePlan} title={t.planHint}>
                    <Save size={15} aria-hidden /> {t.savePlan}
                  </button>
                  <button className="ghost" onClick={() => planRef.current?.click()} title={t.planHint}>
                    <FolderOpen size={15} aria-hidden /> {t.loadPlan}
                  </button>
                  <button className="ghost" onClick={copyLeg} title={t.copyLegTip}>
                    <Copy size={15} aria-hidden /> {t.copyLeg2}
                  </button>
                </div>
                <input ref={planRef} type="file" accept=".json,application/json,.xlsx" onChange={loadPlan} hidden />
              </div>
            </div>
  );
}

export function SectionCounts({ count, t, carMin, carMax, total, setCounts }) {
  return (
    <Reveal as="div" className="cp-counts">
              {[
                ["car", count.car, t.byCar, carMin, Math.min(carMax, total)],
                ["tram", count.tram, t.byTram, 0, total - count.car],
                ["taxi", count.taxi, t.byTaxi, 0, total - count.car],
              ].map(([k, n, label, min, max]) => (
                <div key={k} className={`count c-${k}`}>
                  <div className="count-ctl" role="group" aria-label={label}>
                    <button onClick={() => setCounts(k, n - 1)} disabled={n <= min} aria-label={`${label} −1`}><Minus size={16} aria-hidden /></button>
                    <button onClick={() => setCounts(k, n + 1)} disabled={n >= max} aria-label={`${label} +1`}><Plus size={16} aria-hidden /></button>
                  </div>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </Reveal>
  );
}

export function SectionChecks({ t, warns, checks, setRulesOpen, rules, goToCheck }) {
  return (
    <Reveal id="checks" className="tile">
              <div className="checks-head">
                <h2 className="tile-title">{t.checksH}</h2>
                {/* every hint is counted, warnings and infos alike; peach while there is a warning */}
                <span className={`warn-badge${warns ? "" : " calm"}`}>{checks.length}</span>
                <button className="ghost rules-open" onClick={() => setRulesOpen(true)} aria-haspopup="dialog">
                  <ListPlus size={15} aria-hidden /> {t.rulesBtn}
                  {rules.some(ruleReady) ? ` (${rules.filter(ruleReady).length})` : ""}
                </button>
              </div>
              <p className="tile-note">{t.checksSub}</p>
              {checks.length ? (
                <ul className="check-list">
                  {checks.map((c, i) => (
                    <li
                      key={i}
                      className={`check go ${c.level}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToCheck(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToCheck(c);
                        }
                      }}
                    >
                      <span className="check-icon">{c.level === "warn" ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}</span>
                      <span className="check-leg">{t.legWord} {c.leg + 1}</span>
                      <span className="check-text">{t.chk[c.code](c.args, t.kinds)}</span>
                      <ArrowRight className="check-go" size={16} aria-hidden />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="check ok">
                  <span className="check-icon"><CircleCheck size={18} aria-hidden /></span> {t.noIssues}
                </p>
              )}
            </Reveal>
  );
}

export function SectionCars({ t, count, order, times, L, setTime, filled, boxes, byId, dnd, pick }) {
  return (
    <Reveal id="cars" className="tile">
              <h2 className="tile-title">{t.carsH} ({count.car})</h2>
              <p className="tile-note">{t.carsSub}</p>
              {order.cars.length ? (
                <>
                  <p className="tile-note drag-hint">{t.moveHint}</p>
                  <div className="plan-grid">
                    {order.cars.map((id, n) => (
                      <article key={id} className="pcard">
                        <div className="pcard-head">
                          <h3>{t.car} {n + 1}</h3>
                          <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                          <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        </div>
                        <CarMap carId={id} slots={boxes[id].map((pid) => (pid ? byId[pid] : null))} dnd={dnd} pick={pick} t={t} />
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="tile-note">{t.noCars}</p>
              )}
            </Reveal>
  );
}

export function SectionTram({ t, count, from, order, groupPeople, limits, setGroupCount, setLimits, tickets, times, L, setTime, filled, boxes, removeBox, byId, dnd, pick, buyers, setBuyer }) {
  return (
    <Reveal id="tram" className="tile">
              <h2 className="tile-title">{t.tramH} ({count.tram})</h2>
              <p className="tile-note">{t.tramSub(from)}</p>
              <div className="box-tools">
                <Stepper label={t.groupCount} value={order.groups.length} min={groupPeople ? Math.ceil(groupPeople / limits.groupMax) : 0} max={groupPeople ? groupPeople : LIMIT_RANGE[1]} onChange={setGroupCount} />
                <Stepper label={t.groupSize} value={limits.groupMax} min={LIMIT_RANGE[0]} max={LIMIT_RANGE[1]} onChange={(v) => setLimits((l) => ({ ...l, groupMax: v }))} />
                <span className="chip-static hide-m"><Ticket size={14} aria-hidden /> {t.tickets(tickets)}</span>
              </div>
              {order.groups.length ? (
                <div className="plan-grid">
                  {order.groups.map((id, n) => (
                    <article key={id} className="pcard">
                      <div className="pcard-head">
                        <h3>{t.group} {n + 1}</h3>
                        <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                        <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        {filled(id) === 0 ? (
                          <button className="icon-btn" onClick={() => removeBox("groups", id)} aria-label={t.removeBox} title={t.removeBox}>
                            <X size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <ul>
                        {boxes[id].map((pid, i) => (
                          <Slot
                            key={i}
                            p={pid ? byId[pid] : null}
                            idx={i}
                            boxId={id}
                            kind="tram"
                            dnd={dnd}
                            pick={pick}
                            t={t}
                            buyer={pid && buyers[id] === pid}
                            onBuyer={() => setBuyer(id, pid)}
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
  );
}

export function SectionTaxi({ t, count, limits, setLimits, addBox, order, times, L, setTime, filled, boxes, removeBox, byId, dnd, pick }) {
  return (
    <Reveal id="taxi" className="tile">
              <h2 className="tile-title">{t.taxiH} ({count.taxi})</h2>
              <p className="tile-note">{t.taxiSub}</p>
              <div className="box-tools">
                <Stepper label={t.taxiSize} value={limits.taxiSeats} min={TAXI_RANGE[0]} max={TAXI_RANGE[1]} onChange={(v) => setLimits((l) => ({ ...l, taxiSeats: v }))} />
                <button className="ghost" onClick={() => addBox("taxis")}>
                  <Plus size={15} aria-hidden /> {t.addTaxi}
                </button>
              </div>
              {order.taxis.length ? (
                <div className="plan-grid">
                  {order.taxis.map((id, n) => (
                    <article key={id} className="pcard">
                      <div className="pcard-head">
                        <h3>{t.taxi} {n + 1}</h3>
                        <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                        <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        {filled(id) === 0 ? (
                          <button className="icon-btn" onClick={() => removeBox("taxis", id)} aria-label={t.removeBox} title={t.removeBox}>
                            <X size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <ul>
                        {boxes[id].map((pid, i) => (
                          <Slot key={i} p={pid ? byId[pid] : null} idx={i} boxId={id} kind="taxi" dnd={dnd} pick={pick} t={t} />
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tile-note">{t.nothing}</p>
              )}
            </Reveal>
  );
}

export function SectionPeople({ t, rows, setCount, persons, submitAdd, newName, setNewName, fileRef, loadFile, resetData, filter, setFilter, tagInfo, tagFilter, setTagFilter, filterBy, assignment, leg, openRows, patch, toggleLeg, setOpenRows, removePerson }) {
  return (
    <Reveal id="all" className="tile">
              <h2 className="tile-title">{t.allH} ({rows.length})</h2>
              <p className="tile-note">{t.allSub}</p>

              <div className="roster-tools">
                <div className="stepper" role="group" aria-label={t.count}>
                  <button onClick={() => setCount(Math.max(1, persons.length - 1))} aria-label="−1"><Minus size={16} aria-hidden /></button>
                  <strong>{persons.length}</strong>
                  <button onClick={() => setCount(persons.length + 1)} aria-label="+1"><Plus size={16} aria-hidden /></button>
                </div>
                <form className="add-form" onSubmit={submitAdd}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.addPh} aria-label={t.addPh} />
                  <button type="submit" className="ghost">{t.add}</button>
                </form>
                <button className="ghost" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} aria-hidden /> {t.load}
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={loadFile} hidden />
                <button className="ghost" onClick={resetData}>
                  <RotateCcw size={15} aria-hidden /> {t.reset}
                </button>
              </div>
              <p className="tile-note csv-hint">{t.csvHint}</p>

              <div className="cp-filter" role="group">
                {[
                  ["all", t.filterAll],
                  ["car", t.car],
                  ["driver", t.driver],
                  ["tram", t.segTram],
                  ["taxi", t.taxi],
                  ["away", t.filterAway],
                ].map(([k, label]) => (
                  <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} aria-pressed={filter === k}>
                    {label}
                  </button>
                ))}
              </div>
              {tagInfo.values.length ? (
                <div className="cp-filter tags" role="group">
                  {[null, ...tagInfo.values].map((v) => (
                    <button key={v ?? "all"} className={tagFilter === v ? "on" : ""} onClick={() => setTagFilter(v)} aria-pressed={tagFilter === v}>
                      {v ? <i style={{ background: tagInfo.color(v) }} /> : null}
                      {v ?? `${filterBy === "lang" ? t.langCol : t.team}: ${t.all}`}
                    </button>
                  ))}
                </div>
              ) : null}
              {!rows.length && newName.trim() ? <p className="tile-note">{t.noMatch(newName.trim())}</p> : null}
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t.name}</th>
                      <th>{t.team}</th>
                      <th>{t.langCol}</th>
                      <th>{t.noteCol}</th>
                      <th>{t.mode}</th>
                      {LEGS.map((lg, i) => (
                        <th key={i}>{t.leg} {i + 1}</th>
                      ))}
                      <th>{t.assign}</th>
                      <th aria-label={t.remove} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const a = assignment.get(p.id);
                      const idx = persons.indexOf(p) + 1;
                      return (
                        <tr key={p.id} className={(p.legs[leg] ? "" : "is-away") + (openRows[p.id] ? "" : " folded")}>
                          <td className="c-num" data-label="#">{idx}</td>
                          <td data-label={t.name}>{p.name}</td>
                          <td data-label={t.team}>
                            <LangSelect
                              className="wide"
                              value={p.team}
                              onValueChange={(v) => patch(p.id, { team: v })}
                              options={[...new Set([...persons.map((q) => q.team), p.team].filter(Boolean))]
                                .sort((x, y) => x.localeCompare(y))
                                .map((v) => ({ value: v, label: v }))}
                              label={`${t.team}: ${p.name}`}
                            />
                          </td>
                          <td data-label={t.langCol}>
                            <LangSelect
                              value={p.lang}
                              onValueChange={(v) => patch(p.id, { lang: v })}
                              options={LANG_OPTIONS.map((l) => ({ value: l, label: l }))}
                              label={`${t.langCol}: ${p.name}`}
                            />
                          </td>
                          <td data-label={t.noteCol}>
                            <input
                              key={`${p.id}:${p.note}`}
                              className="cell-input note"
                              defaultValue={p.note}
                              maxLength={60}
                              placeholder="–"
                              aria-label={`${t.noteCol}: ${p.name}`}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== p.note) patch(p.id, { note: v });
                              }}
                              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            />
                          </td>
                          <td data-label={t.mode}>
                            <span className="car-cell">
                              <button
                                className={`chip${p.car ? " on" : ""}`}
                                onClick={() => patch(p.id, { car: !p.car })}
                                aria-pressed={p.car}
                                aria-label={`${t.mode}: ${p.name}`}
                              >
                                <Car size={14} aria-hidden />
                              </button>
                              {p.car ? (
                                <span className="mini" role="group" aria-label={t.seatsOf}>
                                  <button onClick={() => patch(p.id, { seats: Math.max(MIN_SEATS, p.seats - 1) })} aria-label="−"><Minus size={12} aria-hidden /></button>
                                  <span>{p.seats} {t.seatsOf}</span>
                                  <button onClick={() => patch(p.id, { seats: Math.min(CAR_SEATS, p.seats + 1) })} aria-label="+"><Plus size={12} aria-hidden /></button>
                                </span>
                              ) : null}
                            </span>
                          </td>
                          {LEGS.map((lg, i) => (
                            <td key={i} data-label={`${t.leg} ${i + 1}`}>
                              <button
                                className={`chip${p.legs[i] ? " on" : ""}`}
                                onClick={() => toggleLeg(p, i)}
                                aria-pressed={p.legs[i]}
                                aria-label={`${t.leg} ${i + 1}: ${p.name}`}
                              >
                                {p.legs[i] ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} aria-hidden />} {lg.time}
                              </button>
                            </td>
                          ))}
                          <td data-label={t.assign}>
                            {a ? (
                              <span className="assign">
                                <span className={`pill ${a.kind}`}>{a.label}</span>
                                {a.role ? <span className="role"> · {a.role}</span> : null}
                              </span>
                            ) : (
                              <span className="assign"><span className="pill away">{t.notThere}</span></span>
                            )}
                          </td>
                          <td className="c-del" data-label="">
                            <button className="fold-btn" onClick={() => setOpenRows((o) => ({ ...o, [p.id]: !o[p.id] }))} aria-expanded={!!openRows[p.id]} aria-label={`${p.name}: ${openRows[p.id] ? t.foldClose : t.foldOpen}`}>
                              <ChevronDown size={18} aria-hidden />
                            </button>
                            <button className="icon-btn" onClick={() => removePerson(p.id)} aria-label={`${t.remove}: ${p.name}`} title={t.remove}>
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
  );
}

export function SectionCards({ t, copyCards, legCards, leg, legHead, L }) {
  return (
    <Reveal id="cards" className="tile">
              <h2 className="tile-title">{t.cardsH}</h2>
              <p className="tile-note">{t.cardsSub}</p>
              <div className="box-tools">
                <button
                  className="ghost"
                  onClick={() =>
                    copyCards(
                      legCards[leg].cards.map((c) => cardText(c, legHead(L, leg), t)).join("\n\n"),
                      t.copied
                    )
                  }
                >
                  <Copy size={15} aria-hidden /> {t.copyLeg}
                </button>
              </div>
              <div className="plan-grid">
                {legCards[leg].cards.map((c) => (
                  <article key={c.id} className="pcard info-card">
                    <div className="pcard-head">
                      <h3>{c.title}</h3>
                      <button className="icon-btn" onClick={() => copyCards(cardText(c, legHead(L, leg), t), t.copied)} aria-label={`${t.copy}: ${c.title}`} title={t.copy}>
                        <Copy size={16} aria-hidden />
                      </button>
                    </div>
                    {c.lead ? (
                      <p className="info-lead">
                        <span>{c.lead[0]}</span> {c.lead[1]}
                      </p>
                    ) : null}
                    <p className="info-label">{c.kind === "car" ? t.passengers : t.members}</p>
                    <p className="info-people">{c.people.join(", ") || "–"}</p>
                  </article>
                ))}
              </div>
            </Reveal>
  );
}
