// Code lists for the fields of /AESM/STR_BP.
// TODO: verify against the SAP side before the first real call:
//  - GENDER (CHAR 1): values of the domain behind /AESM/DTE_GENDER
//  - NATIO / COUNTRY / DOC_COUNTRY: ISO alpha-2 like SAP's LAND1 (the blocklist stores 'RU')
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
  { value: 'DE', de: 'Deutschland', en: 'Germany' },
  { value: 'AT', de: 'Österreich', en: 'Austria' },
  { value: 'CH', de: 'Schweiz', en: 'Switzerland' },
  { value: 'TR', de: 'Türkei', en: 'Turkey' },
  { value: 'PL', de: 'Polen', en: 'Poland' },
  { value: 'BY', de: 'Belarus', en: 'Belarus' },
  { value: 'RU', de: 'Russland', en: 'Russia' },
  { value: 'UA', de: 'Ukraine', en: 'Ukraine' },
  { value: 'FR', de: 'Frankreich', en: 'France' },
  { value: 'IT', de: 'Italien', en: 'Italy' },
  { value: 'ES', de: 'Spanien', en: 'Spain' },
  { value: 'NL', de: 'Niederlande', en: 'Netherlands' },
  { value: 'GB', de: 'Vereinigtes Königreich', en: 'United Kingdom' },
  { value: 'US', de: 'USA', en: 'USA' },
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
