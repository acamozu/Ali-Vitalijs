import { useState } from 'react';
import { useI18n } from '../i18n.js';
import { countries, docTypes, genders } from '../data/codes.js';
import FieldSelect from './FieldSelect.jsx';
import DatePicker from './DatePicker.jsx';

// Required = what the verification needs; middlename, building and room are optional.
const stepFields = [
  ['lastname', 'firstname', 'middlename', 'birthdate', 'gender', 'nationality'],
  ['street', 'houseno', 'building', 'roomno', 'zip', 'city', 'country'],
  ['docType', 'docNumber', 'docCountry'],
];
const optional = new Set([
  'middlename', 'building', 'roomno',
  'birthdate', 'gender', 'nationality',
  'docType', 'docNumber', 'docCountry',
]);

export default function StepForm({ tariff, search, onSubmit, onBack, busy }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('next'); // slide direction of the step change
  const [values, setValues] = useState({
    lastname: '', firstname: '', middlename: '', birthdate: '', gender: '', nationality: '',
    street: '', houseno: '', building: '', roomno: '', zip: '', city: '', country: '',
    docType: '', docNumber: '', docCountry: '',
    bpNumber: '', // typed by hand: checks this existing business partner of the SAP system
  });
  const [errors, setErrors] = useState({});

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const validate = (fields) => {
    // With a BP number the check needs nothing else from the form.
    if (values.bpNumber.trim()) {
      setErrors({});
      return true;
    }
    const next = {};
    fields.forEach((f) => {
      if (!optional.has(f) && !String(values[f]).trim()) next[f] = t.form.missing;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validate(stepFields[step])) return;
    setDir('next');
    setStep(step + 1);
  };
  const back = () => {
    if (step === 0) return onBack();
    setDir('back');
    setStep(step - 1);
  };
  const submit = () => validate(stepFields[2]) && onSubmit(values);

  // Clicking or tabbing into a field takes its error away; "Weiter" validates again.
  const clearError = (name) => setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));

  // The message slot is always there (same height with or without an error), so an error
  // appearing in one field does not move or stretch its neighbours.
  const fieldError = (name) => (
    <em className="field__error" role={errors[name] ? 'alert' : undefined}>{errors[name]}</em>
  );

  const text = (name, extra = {}) => (
    <label className="field" key={name}>
      <span>{t.form[name]}{optional.has(name) ? '' : ' *'}</span>
      <input
        value={values[name]}
        aria-invalid={errors[name] ? 'true' : undefined}
        onFocus={() => clearError(name)}
        onChange={(e) => set(name, e.target.value)}
        {...extra}
      />
      {fieldError(name)}
    </label>
  );

  const select = (name, options, label) => (
    <div className="field" key={name}>
      <label htmlFor={`field-${name}`}>{t.form[name]}{optional.has(name) ? '' : ' *'}</label>
      <FieldSelect
        id={`field-${name}`}
        value={values[name]}
        placeholder={t.form.select}
        invalid={Boolean(errors[name])}
        options={options.map((o) => ({ value: o.value, label: label(o) }))}
        onFocus={() => clearError(name)}
        onValueChange={(v) => set(name, v)}
      />
      {fieldError(name)}
    </div>
  );

  const date = (name) => (
    <div className="field" key={name}>
      <label htmlFor={`field-${name}`}>{t.form[name]}{optional.has(name) ? '' : ' *'}</label>
      <DatePicker
        id={`field-${name}`}
        value={values[name]}
        invalid={Boolean(errors[name])}
        onFocus={() => clearError(name)}
        onChange={(v) => set(name, v)}
      />
      {fieldError(name)}
    </div>
  );

  const countryLabel = (o) => o[lang];
  const formRows = [
    [t.form.fullName, `${values.firstname} ${values.middlename} ${values.lastname}`.replace(/\s+/g, ' ').trim()],
    [t.form.birthdate, values.birthdate],
    [t.form.street, `${values.street} ${values.houseno}`],
    [t.form.city, `${values.zip} ${values.city}`],
    [t.form.docType, [values.docType, values.docNumber].filter(Boolean).join(' · ')],
  ].filter(([, v]) => String(v).trim()); // optional fields that stay empty are not listed
  const summaryRows = values.bpNumber.trim() ? [[t.form.bpNumber, values.bpNumber.trim()]] : formRows;

  return (
    <section className="card form view-in">
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / t.steps.length) * 100}%` }} />
      </div>
      <ol className="stepper">
        {t.steps.map((label, i) => (
          <li key={label} className={i === step ? 'is-active' : i < step ? 'is-done' : ''}>
            <span>{i + 1}</span>{label}
          </li>
        ))}
      </ol>
      <p className="muted">{t.form.required}</p>
      <p className="muted">{t.form.tariff}: <strong>{tariff.name}</strong> · {search.zip} {search.city}</p>

      <div key={step} className={`step-pane step-pane--${dir}`}>
      <div className="grid">
        {step === 0 && (
          <>
            <label className="field field--wide">
              <span>{t.form.bpNumber}</span>
              <input
                value={values.bpNumber}
                inputMode="numeric"
                onChange={(e) => set('bpNumber', e.target.value.replace(/\D/g, ''))}
              />
              <em className="field__hint">{t.form.bpHint}</em>
            </label>
            {text('lastname')}
            {text('firstname')}
            {text('middlename')}
            {date('birthdate')}
            {select('gender', genders, (o) => t.gender[o.key])}
            {select('nationality', countries, countryLabel)}
          </>
        )}
        {step === 1 && (
          <>
            {text('street')}
            {text('houseno')}
            {text('building')}
            {text('roomno')}
            {text('zip', { inputMode: 'numeric' })}
            {text('city')}
            {select('country', countries, countryLabel)}
          </>
        )}
        {step === 2 && (
          <>
            {select('docType', docTypes, (o) => t.docTypes[o.key])}
            {text('docNumber')}
            {select('docCountry', countries, countryLabel)}
          </>
        )}
      </div>

      {step === 2 && (
        <dl className="summary">
          <h3>{t.form.summary}</h3>
          {summaryRows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      </div>

      <div className="actions">
        <button className="btn btn--ghost" type="button" disabled={busy} onClick={back}>
          {t.form.back}
        </button>
        {step < 2 ? (
          <button className="btn" type="button" onClick={next}>{t.form.next}</button>
        ) : (
          <button className="btn" type="button" disabled={busy} onClick={submit}>
            {busy ? t.form.sending : t.form.submit}
          </button>
        )}
      </div>
    </section>
  );
}
