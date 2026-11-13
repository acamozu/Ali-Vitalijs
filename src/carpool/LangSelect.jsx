import { Select } from "@base-ui/react/select";

// Dropdown like the one of the stromplus web app (Base UI Select): the list is a portal, as wide as the trigger.
// options: [{ value, label }]; value "" = nothing chosen (shows the placeholder)
const ChevronDown = () => (
  <svg className="select__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = () => (
  <svg className="select__check-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NONE = "__none";

export default function LangSelect({ value, onValueChange, options, placeholder = "–", clearLabel = "–", label, className = "", noClear = false, align = "start", disabled = false }) {
  const items = noClear ? options : [{ value: NONE, label: clearLabel }, ...options];
  return (
    <Select.Root disabled={disabled} items={items} value={value || null} modal={false} onValueChange={(next) => next != null && onValueChange(next === NONE ? "" : next)}>
      <Select.Trigger className={`select__trigger ${className}`} aria-label={label}>
        <Select.Value className="select__value" placeholder={placeholder} />
        <Select.Icon render={<ChevronDown />} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          sideOffset={4}
          align={align}
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: "none", align: "none" }}
          className="select__positioner"
        >
          <Select.Popup className="select__popup">
            <Select.List className="select__list">
              {items.map((option) => (
                <Select.Item key={option.value} value={option.value} className="select__item">
                  <Select.ItemText className="select__item-text">{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="select__check">
                    <Check />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
