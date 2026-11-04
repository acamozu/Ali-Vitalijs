import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n.js';

const locales = { de: 'de-DE', en: 'en-GB' };
const PANEL_WIDTH = 288;

// Value = local calendar day as YYYY-MM-DD (no time zone shifts, unlike toISOString()).
const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function parseIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ISO strings of the same format compare correctly as text
const isBeforeMin = (day, min) => Boolean(min) && toIso(day) < toIso(min);

// Monday first, empty cells pad the month to full weeks
function buildMonthCells(year, month) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const yearRangeStart = (year) => Math.floor(year / 12) * 12;
const cx = (...parts) => parts.filter(Boolean).join(' ');

const Icon = ({ children, className = 'dp__icon' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const CalendarIcon = () => (
  <Icon><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></Icon>
);
const ChevronLeft = () => <Icon><path d="M15 6l-6 6 6 6" /></Icon>;
const ChevronRight = () => <Icon><path d="M9 6l6 6-6 6" /></Icon>;
const ChevronsLeft = () => <Icon><path d="M11 6l-6 6 6 6M18 6l-6 6 6 6" /></Icon>;
const ChevronsRight = () => <Icon><path d="M13 6l6 6-6 6M6 6l6 6-6 6" /></Icon>;
const CloseIcon = () => <Icon className="dp__icon dp__icon--small"><path d="M6 6l12 12M18 6L6 18" /></Icon>;

export default function DatePicker({ id, value, onChange, placeholder, invalid, minDate, onFocus }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // days | months | years
  const selected = useMemo(() => parseIso(value), [value]);
  const min = useMemo(() => (minDate ? parseIso(minDate) : null), [minDate]);
  const [view, setView] = useState(() => {
    const base = selected ?? min ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState({});

  // open on the selected month (or this month) and start on the day view
  useEffect(() => {
    if (!open) return;
    const base = selected ?? min ?? new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
    setMode('days');
  }, [open, selected, min]);

  // the panel sits in a portal on <body>: fixed below the trigger, kept inside the window
  useEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
      setPanelStyle({ position: 'fixed', top: rect.bottom + 6, left, width: PANEL_WIDTH, zIndex: 100 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (mode === 'days') setOpen(false);
      else if (mode === 'months') setMode('days');
      else setMode('months');
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, mode]);

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view.year, view.month]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const todayDisabled = isBeforeMin(today, min);
  const years = useMemo(() => {
    const start = yearRangeStart(view.year);
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view.year]);

  const display = selected
    ? new Intl.DateTimeFormat(locales[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(selected)
    : '';

  const shiftMonth = (delta) =>
    setView((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  const shiftYear = (delta) => setView((prev) => ({ ...prev, year: prev.year + delta }));

  const title = () => {
    if (mode === 'years') {
      const start = yearRangeStart(view.year);
      return `${start} – ${start + 11}`;
    }
    if (mode === 'months') return String(view.year);
    return `${t.date.months[view.month]} ${view.year}`;
  };
  const onHeaderClick = () => setMode(mode === 'days' ? 'months' : 'years');
  const onPrev = () => (mode === 'days' ? shiftMonth(-1) : shiftYear(mode === 'months' ? -1 : -12));
  const onNext = () => (mode === 'days' ? shiftMonth(1) : shiftYear(mode === 'months' ? 1 : 12));
  const prevLabel = mode === 'years' ? t.date.prevYears : mode === 'months' ? t.date.prevYear : t.date.prevMonth;
  const nextLabel = mode === 'years' ? t.date.nextYears : mode === 'months' ? t.date.nextYear : t.date.nextMonth;

  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="dp">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={cx('dp__trigger', !display && 'is-empty')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onFocus={onFocus}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dp__trigger-text">
          <CalendarIcon />
          <span className="dp__value">{display || placeholder || t.date.placeholder}</span>
        </span>
        {value && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={t.date.clearDate}
            className="dp__clear"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pick('');
            }}
          >
            <CloseIcon />
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div ref={panelRef} style={panelStyle} role="dialog" aria-label={t.date.dialog} className="dp__panel">
            <div className="dp__head">
              <div className="dp__nav-group">
                {mode === 'days' && (
                  <button type="button" className="dp__nav" aria-label={t.date.prevYear} onClick={() => shiftYear(-1)}>
                    <ChevronsLeft />
                  </button>
                )}
                <button type="button" className="dp__nav" aria-label={prevLabel} onClick={onPrev}>
                  <ChevronLeft />
                </button>
              </div>
              <button type="button" className="dp__title" onClick={onHeaderClick} disabled={mode === 'years'}>
                {title()}
              </button>
              <div className="dp__nav-group">
                <button type="button" className="dp__nav" aria-label={nextLabel} onClick={onNext}>
                  <ChevronRight />
                </button>
                {mode === 'days' && (
                  <button type="button" className="dp__nav" aria-label={t.date.nextYear} onClick={() => shiftYear(1)}>
                    <ChevronsRight />
                  </button>
                )}
              </div>
            </div>

            {mode === 'years' && (
              <div className="dp__grid dp__grid--3">
                {years.map((year) => {
                  const isSelected = selected?.getFullYear() === year;
                  const isCurrent = today.getFullYear() === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      className={cx('dp__cell dp__cell--wide', isSelected && 'is-selected', !isSelected && isCurrent && 'is-current')}
                      onClick={() => {
                        setView((prev) => ({ ...prev, year }));
                        setMode('months');
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}

            {mode === 'months' && (
              <div className="dp__grid dp__grid--3">
                {t.date.monthsShort.map((label, month) => {
                  const isSelected = selected?.getFullYear() === view.year && selected.getMonth() === month;
                  const isCurrent = today.getFullYear() === view.year && today.getMonth() === month;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={cx('dp__cell dp__cell--wide', isSelected && 'is-selected', !isSelected && isCurrent && 'is-current')}
                      onClick={() => {
                        setView((prev) => ({ ...prev, month }));
                        setMode('days');
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {mode === 'days' && (
              <>
                <div className="dp__grid dp__grid--7 dp__weekdays">
                  {t.date.weekdays.map((day) => (
                    <div key={day} className="dp__weekday">{day}</div>
                  ))}
                </div>
                <div className="dp__grid dp__grid--7">
                  {cells.map((cell, index) => {
                    if (!cell) return <div key={`empty-${index}`} className="dp__cell dp__cell--empty" />;
                    const iso = toIso(cell);
                    const isSelected = selected ? sameDay(cell, selected) : false;
                    const disabled = isBeforeMin(cell, min);
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={disabled}
                        className={cx('dp__cell', isSelected && 'is-selected', !disabled && !isSelected && sameDay(cell, today) && 'is-current')}
                        onClick={() => pick(iso)}
                      >
                        {cell.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="dp__foot">
              <button type="button" className="dp__action" disabled={todayDisabled} onClick={() => pick(toIso(today))}>
                {t.date.today}
              </button>
              <button type="button" className="dp__action" onClick={() => pick('')}>
                {t.date.clear}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
