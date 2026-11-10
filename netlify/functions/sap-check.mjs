// Netlify replacement for the Vite dev proxy: forwards the check to the SAP ICF handler
// ZCL_ESM_WEB_CHECK. SAP host and credentials come from the Netlify environment variables,
// never from the browser or the repo. Only this one SAP service is reachable, not all of /sap.
import https from 'node:https';

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

function post(url, auth, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        auth,
        rejectUnauthorized: false, // the A2H certificate is expired, same as secure: false in vite.config.js
        timeout: 25000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('SAP did not answer in time.')));
    req.on('error', reject);
    req.end(body);
  });
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  const { SAP_HOST, SAP_USER, SAP_PASSWORD, SAP_CLIENT, ACCESS_CODE } = process.env;
  if (!SAP_HOST || !SAP_USER || !SAP_PASSWORD) return json(500, { error: 'SAP connection is not configured.' });

  // Optional: if ACCESS_CODE is set, the site is protected (without the code nobody can trigger
  // Schufa queries or create partners). If it is not set, the check is open to everyone.
  if (ACCESS_CODE && request.headers.get('x-access-code') !== ACCESS_CODE) return json(401, { error: 'Wrong access code.' });

  const url = new URL('/sap/zesm_web_check', SAP_HOST);
  if (SAP_CLIENT) url.searchParams.set('sap-client', SAP_CLIENT);

  try {
    const sap = await post(url, `${SAP_USER}:${SAP_PASSWORD}`, await request.text());
    // The handler answers JSON; anything else (e.g. an SAP error page) becomes a short error
    try {
      return json(sap.status, JSON.parse(sap.body));
    } catch {
      return json(502, { error: `SAP returned ${sap.status}.` });
    }
  } catch (e) {
    return json(502, { error: e.message });
  }
};

export const config = { path: '/sap/zesm_web_check' };
