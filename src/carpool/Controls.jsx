import { Minus, Plus, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

// tiles are shown right away (no scroll animation)
export function Reveal({ as: Tag = "section", className = "", children, ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  );
}

export function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="lim">
      <span>{label}</span>
      <span className="stepper small" role="group" aria-label={label}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−1"><Minus size={14} aria-hidden /></button>
        <strong>{value}</strong>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+1"><Plus size={14} aria-hidden /></button>
      </span>
    </div>
  );
}

// thin bar above a section while the order is being changed
export function MoveBar({ label, first, last, onUp, onDown, t }) {
  return (
    <div className="move-bar">
      <GripVertical size={16} aria-hidden />
      <span>{label}</span>
      <div>
        <button onClick={onUp} disabled={first} aria-label={`${t.up}: ${label}`} title={t.up}>
          <ArrowUp size={16} aria-hidden />
        </button>
        <button onClick={onDown} disabled={last} aria-label={`${t.down}: ${label}`} title={t.down}>
          <ArrowDown size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// departure time of one vehicle, always 24 h ("14:50"; the native time field would follow the browser's 12 h setting).
// Type digits: "1450", "930" or "9" -> 14:50, 09:30, 09:00. Empty = back to the time of the leg. Grey while it is the time of the leg.
export function DepartTime({ value, base, label, onChange }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const d = raw.replace(/\D/g, "");
    setDraft(null);
    if (!d) return onChange("");
    const hh = d.length <= 2 ? +d : d.length === 3 ? +d[0] : +d.slice(0, 2);
    const mm = d.length <= 2 ? 0 : +d.slice(d.length === 3 ? 1 : 2);
    if (hh < 24 && mm < 60) onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder="HH:MM"
      className={`time-input${draft === null && value === base ? " base" : ""}`}
      value={draft ?? value}
      aria-label={label}
      title={`${label} (24 h)`}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 4);
        setDraft(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
