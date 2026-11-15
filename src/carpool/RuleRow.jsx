import LangSelect from "./LangSelect.jsx";
import { LANG_OPTIONS } from "./planner.js";
import { TriangleAlert, Info, Trash2 } from "lucide-react";

export const RULE_GRADS = ["var(--grad-peach)", "var(--grad-lilac)", "var(--grad-blue)", "var(--grad-green)"];

// one custom rule: on/off, its sentence made of dropdowns, warning or info, delete
export function RuleRow({ rule, persons, teams, t, onChange, onRemove }) {
  const set = (patch) => onChange({ ...rule, ...patch });
  const people = [...persons].sort((x, y) => x.name.localeCompare(y.name)).map((p) => ({ value: p.id, label: p.name }));
  return (
    <li className={`rule-row${rule.on ? "" : " off"}`}>
      <button
        className={`switch${rule.on ? " on" : ""}`}
        role="switch"
        aria-checked={rule.on}
        aria-label={t.ruleOn}
        title={t.ruleOn}
        onClick={() => set({ on: !rule.on })}
      >
        <i className="track">
          <span />
        </i>
        <b>{rule.on ? t.ruleActive : t.ruleInactive}</b>
      </button>
      <div className="rule-body">
        {rule.type === "pair" ? (
          <>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.a} options={people.filter((o) => o.value !== rule.b)} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ a: v })} />
            <span>{t.pairWith}</span>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.b} options={people.filter((o) => o.value !== rule.a)} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ b: v })} />
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.mode}
              options={[
                { value: "together", label: t.pairTogether },
                { value: "apart", label: t.pairApart },
              ]}
              onValueChange={(v) => set({ mode: v })}
            />
          </>
        ) : null}
        {rule.type === "lang" ? (
          <>
            <span>{t.ruleLangA}</span>
            <LangSelect disabled={!rule.on} noClear value={rule.lang} options={LANG_OPTIONS.map((l) => ({ value: l, label: l }))} label={t.langCol} onValueChange={(v) => set({ lang: v })} />
          </>
        ) : null}
        {rule.type === "teamMax" ? (
          <>
            <span>{t.ruleTeamA}</span>
            <LangSelect disabled={!rule.on} noClear value={String(rule.max)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} label="max" onValueChange={(v) => set({ max: Number(v) })} />
            <span>{t.ruleTeamB}</span>
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.team}
              options={[{ value: "*", label: t.allTeams }, ...teams.map((x) => ({ value: x, label: x }))]}
              label={t.team}
              onValueChange={(v) => set({ team: v })}
            />
          </>
        ) : null}
        {rule.type === "note" ? (
          <>
            <span>{t.noteRuleA}</span>
            <input
              key={rule.id + rule.keyword}
              className="cell-input keyword"
              defaultValue={rule.keyword}
              maxLength={30}
              placeholder={t.keyword}
              aria-label={t.keyword}
              disabled={!rule.on}
              onBlur={(e) => e.target.value.trim() !== rule.keyword && set({ keyword: e.target.value.trim() })}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <LangSelect
              disabled={!rule.on}
              noClear
              className="wide"
              value={rule.rule}
              options={[
                { value: "noTaxi", label: t.personNoTaxi },
                { value: "noTram", label: t.personNoTram },
                { value: "inCar", label: t.personInCar },
                { value: "notAlone", label: t.personNotAlone },
              ]}
              onValueChange={(v) => set({ rule: v })}
            />
          </>
        ) : null}
        {rule.type === "person" ? (
          <>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.p} options={people} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ p: v })} />
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.rule}
              options={[
                { value: "noTaxi", label: t.personNoTaxi },
                { value: "noTram", label: t.personNoTram },
                { value: "inCar", label: t.personInCar },
                { value: "notAlone", label: t.personNotAlone },
              ]}
              onValueChange={(v) => set({ rule: v })}
            />
          </>
        ) : null}
      </div>
      <div className="rule-end">
        <button
          className={`lvl ${rule.level}`}
          disabled={!rule.on}
          onClick={() => set({ level: rule.level === "warn" ? "info" : "warn" })}
          title={`${rule.level === "warn" ? t.levelWarn : t.levelInfo} – ${t.levelToggle}`}
          aria-label={`${rule.level === "warn" ? t.levelWarn : t.levelInfo} – ${t.levelToggle}`}
        >
          {rule.level === "warn" ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}
        </button>
        <button className="icon-btn" onClick={onRemove} aria-label={t.ruleRemove} title={t.ruleRemove}>
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}
