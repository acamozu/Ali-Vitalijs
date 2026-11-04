// Code lists for the fields of /AESM/STR_BP.
// TODO: verify against the SAP side before the first real call:
//  - GENDER (CHAR 1): values of the domain behind /AESM/DTE_GENDER
//  - NATIO / COUNTRY / DOC_COUNTRY (CHAR 3): ISO alpha-3 assumed (e.g. BLR)
//  - DOCUM_TYPE (CHAR 30): which values aESM expects
export const genders = [
  { value: 'M', key: 'male' },
  { value: 'F', key: 'female' },
  { value: 'X', key: 'other' },
];

export const docTypes = [
  { value: 'PASSPORT', key: 'passport' },
  { value: 'ID_CARD', key: 'idcard' },
  { value: 'RESIDENCE_PERMIT', key: 'residence' },
];

export const countries = [
  { value: 'DEU', de: 'Deutschland', en: 'Germany' },
  { value: 'AUT', de: 'Österreich', en: 'Austria' },
  { value: 'CHE', de: 'Schweiz', en: 'Switzerland' },
  { value: 'TUR', de: 'Türkei', en: 'Turkey' },
  { value: 'POL', de: 'Polen', en: 'Poland' },
  { value: 'BLR', de: 'Belarus', en: 'Belarus' },
  { value: 'RUS', de: 'Russland', en: 'Russia' },
  { value: 'UKR', de: 'Ukraine', en: 'Ukraine' },
  { value: 'FRA', de: 'Frankreich', en: 'France' },
  { value: 'ITA', de: 'Italien', en: 'Italy' },
  { value: 'ESP', de: 'Spanien', en: 'Spain' },
  { value: 'NLD', de: 'Niederlande', en: 'Netherlands' },
  { value: 'GBR', de: 'Vereinigtes Königreich', en: 'United Kingdom' },
  { value: 'USA', de: 'USA', en: 'USA' },
];

// Flow control status (/AESM/DOM_FL_STATUS) -> what the web app shows.
// A verify call can only return 01, 02, 03 or 07; 04/05/06/08 are set later by the officer in the cockpit.
export const outcomeByStatus = {
  '01': 'approved',
  '03': 'approved',
  '02': 'review',
  '07': 'rejected',
};
export const outcomeFor = (status) => outcomeByStatus[status] ?? 'review';
