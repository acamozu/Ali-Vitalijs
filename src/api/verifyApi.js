// Single place that talks to the backend. The UI only knows verifyBp().
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// Fields of /AESM/STR_BP. EXTERNAL_OBJECT 'MD' = data comes from the caller, not from an SAP business partner.
export function toPartnerStructure(f) {
  return {
    EXTERNAL_ID: 'WEBAPP',
    BP_NUMBER: 'NOTPROVIDED',
    EXTERNAL_OBJECT: 'MD',
    LASTNAME: f.lastname,
    FIRSTNAME: f.firstname,
    MIDDLENAME: f.middlename,
    NATIO: f.nationality,
    B_DATE: f.birthdate.replaceAll('-', ''), // DATS: YYYYMMDD
    GENDER: f.gender,
    CITY: f.city,
    STREET: f.street,
    COUNTRY: f.country,
    POCODE: f.zip,
    HOUSENO: f.houseno,
    BUILDING: f.building,
    ROOMNO: f.roomno,
    DOCUM_TYPE: f.docType,
    DOC_NUMBER: f.docNumber,
    DOC_COUNTRY: f.docCountry,
  };
}

// Returns { status, techStatus } as in /AESM/STR_FL_STATUS.
export async function verifyBp(form) {
  const partner = toPartnerStructure(form);
  return USE_MOCK ? mockVerify(partner) : sapVerify(partner);
}

async function mockVerify(partner) {
  await new Promise((r) => setTimeout(r, 900));
  const name = `${partner.FIRSTNAME} ${partner.LASTNAME}`.toLowerCase();
  if (name.includes('block')) return { status: '07', techStatus: '00' };
  if (name.includes('suspect') || name.includes('testowski')) return { status: '02', techStatus: '00' };
  if (name.includes('error')) throw new Error('Mock backend error');
  return { status: '01', techStatus: '00' };
}

// The Netlify function (netlify/functions/sap-check.mjs) only answers with the right access code.
// Asked once per browser session; the local Vite proxy never asks for it.
const ACCESS_CODE_KEY = 'accessCode';

function storedAccessCode() {
  try {
    return sessionStorage.getItem(ACCESS_CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeAccessCode(code) {
  try {
    sessionStorage.setItem(ACCESS_CODE_KEY, code);
  } catch {
    // no session storage (private mode): the code is asked again next time
  }
}

// ICF handler ZCL_ESM_WEB_CHECK (abap/zcl_esm_web_check.clas.abap) wrapping /AESM/FM_CHECK_BP.
async function sapVerify(partner, accessCode = storedAccessCode()) {
  const res = await fetch('/sap/zesm_web_check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Access-Code': accessCode },
    body: JSON.stringify(partner),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const code = window.prompt('Zugangscode / Access code');
    if (!code) throw new Error(data.error ?? 'Access code required');
    storeAccessCode(code);
    return sapVerify(partner, code);
  }
  if (!res.ok) throw new Error(data.error ?? `Backend returned ${res.status}`);
  return { status: data.status, techStatus: data.techStatus };
}
