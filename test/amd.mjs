// Tiny AMD loader for the tests: evaluates webapp/model/<name>.js in node with a `sap.ui.define` shim.
// Relative dependencies ("./planner") are resolved against the requiring file, modules are cached.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MODEL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../webapp/model");
const cache = new Map();

function loadFile(file) {
  if (cache.has(file)) return cache.get(file);
  const src = readFileSync(file, "utf8");
  let defined = null;
  const sap = {
    ui: {
      define(deps, factory) {
        if (typeof deps === "function") [deps, factory] = [[], deps];
        defined = { deps, factory };
      },
    },
  };
  // same realm as the tests, so deepStrictEqual sees ordinary Objects / Arrays
  new Function("sap", `${src}\n//# sourceURL=${file.replace(/\\/g, "/")}`)(sap);
  if (!defined) throw new Error(`${file}: sap.ui.define was not called`);
  const args = defined.deps.map((d) => {
    if (!d.startsWith(".")) throw new Error(`${file}: only relative dependencies are supported (${d})`);
    return loadFile(path.resolve(path.dirname(file), `${d}.js`));
  });
  const mod = defined.factory(...args);
  // in the browser model/text.js reads the i18n files through UI5 (load()); here they are read from disk
  if (path.basename(file) === "text.js") {
    for (const lang of mod.LANGS) {
      const texts = readProperties(lang);
      mod.use(lang, (key) => (key in texts ? texts[key] : key));
    }
  }
  cache.set(file, mod);
  return mod;
}

// i18n_<lang>.properties -> { key: text }; "\" + "uXXXX" and backslash escapes are resolved, as UI5 does
export function readProperties(lang) {
  const out = {};
  const file = path.join(MODEL_DIR, "../i18n", `i18n_${lang}.properties`);
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || /^\s*[#!]/.test(line)) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).replace(/\\(u[0-9A-Fa-f]{4}|.)/g, (all, e) => {
      if (e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
      return e === "n" ? "\n" : e;
    });
  }
  return out;
}

export function load(name) {
  return loadFile(path.join(MODEL_DIR, `${name}.js`));
}
