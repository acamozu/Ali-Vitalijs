import { useI18n } from '../i18n.js';
import { tariffs } from '../data/tariffs.js';
import { CheckIcon, PlugIcon } from './Icons.jsx';

const fmt = (n, d = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function TariffList({ search, onSelect }) {
  const { t } = useI18n();
  return (
    <section className="leaves">
      <h2 className="stagger" style={{ '--i': 0 }}>{t.tariffs.title(search.city)}</h2>
      {tariffs.map((tf, i) => (
        <article className="tariff card stagger" style={{ '--i': i + 1 }} key={tf.id}>
          {tf.popular && <span className="badge">{t.tariffs.popular}</span>}
          <div className="tariff__main">
            <div className="tariff__icon"><PlugIcon /></div>
            <div>
              <h3>{tf.name}</h3>
              <p className="muted">{t.tariffs.green}</p>
              <p className="tariff__perk"><CheckIcon /> <strong>{tf.bonus} €</strong> {t.tariffs.bonus}</p>
            </div>
          </div>
          <dl className="tariff__facts">
            <dt>{t.tariffs.minTerm}</dt><dd>{t.tariffs.months(tf.term)}</dd>
            <dt>{t.tariffs.usagePrice}</dt><dd>{fmt(tf.usagePrice)} Cent/kWh</dd>
            <dt>{t.tariffs.basePrice}</dt><dd>{fmt(tf.basePrice)} €/Monat</dd>
          </dl>
          <div className="tariff__price">
            <strong>{tf.yearly} €</strong>
            <span className="muted">{t.tariffs.perYear}</span>
            <button className="btn" onClick={() => onSelect(tf)}>{t.tariffs.order}</button>
          </div>
        </article>
      ))}
    </section>
  );
}
