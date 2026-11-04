// Postal code -> place for DE, FR, IT, ES and GB. Source: github.com/zauberware/postal-codes-json-xml-csv
// (GeoNames, CC BY 4.0), reduced to one place per code. For DE the entries of companies and authorities
// (large-customer codes) are left out. GB has outward codes only (e.g. "SW1A"), so a full postcode is cut down to that.
// The country is not asked for: a code starting with a letter is British, five digits can be DE, FR, IT or ES
// (the format does not tell them apart), so every table is checked. The tables are loaded when first needed.
const tables = {
  DE: () => import('./zip/de.json'),
  FR: () => import('./zip/fr.json'),
  IT: () => import('./zip/it.json'),
  ES: () => import('./zip/es.json'),
  GB: () => import('./zip/gb.json'),
};
const GB_FORMAT = /^[A-Z]{1,2}\d[A-Z\d]?\s*(\d[A-Z]{2})?$/;

// What may be typed: a British code starts with a letter, every other one is digits only.
export const cleanZip = (v) => (/^[a-z]/i.test(v)
  ? v.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8)
  : v.replace(/\D/g, '').slice(0, 5));

export const isZipFormat = (v) => /^\d{5}$/.test(v) || GB_FORMAT.test(v.trim());

const cache = {};
const load = (country) => (cache[country] ??= tables[country]().then((m) => m.default));

// All places this code exists in, in the order DE, FR, IT, ES (GB for codes with letters).
export async function findPlaces(zip) {
  const z = zip.trim();
  const isGb = /^[A-Z]/.test(z);
  const countries = isGb ? ['GB'] : ['DE', 'FR', 'IT', 'ES'];
  const key = isGb ? z.match(/^[A-Z]{1,2}\d[A-Z\d]?/)[0] : z;
  const maps = await Promise.all(countries.map(load));
  return countries.flatMap((country, i) => (maps[i][key] ? [{ country, place: maps[i][key] }] : []));
}
