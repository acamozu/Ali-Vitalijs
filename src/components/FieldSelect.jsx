import { Select } from '@base-ui/react/select';

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

// Dropdown of the step form. The list is rendered in a portal (not cut off by the card),
// as wide as the trigger. options: [{ value, label }]
export default function FieldSelect({ id, value, onValueChange, options, placeholder, invalid, onFocus }) {
  return (
    <Select.Root
      items={options}
      value={value || null}
      modal={false}
      onValueChange={(next) => next != null && onValueChange(next)}
    >
      <Select.Trigger id={id} className="select__trigger" aria-invalid={invalid || undefined} onFocus={onFocus}>
        <Select.Value className="select__value" placeholder={placeholder} />
        <Select.Icon render={<ChevronDown />} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: 'none', align: 'none' }}
          className="select__positioner"
        >
          <Select.Popup className="select__popup">
            <Select.List className="select__list">
              {options.map((option) => (
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
