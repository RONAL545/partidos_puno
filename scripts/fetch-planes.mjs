// Descarga el resumen estructurado del plan de gobierno de cada lista listada en
// data/jne-puno-raw.json (una por codigoExpediente), desde la API pública de
// https://votoinformado.jne.gob.pe :  GET /api/v1/plan-gobierno/resumen?codigoExpediente=...
//
// Igual que fetch-hojas-vida.mjs: una petición a la vez, con pausa, reanudable
// (data/planes.jsonl).
//
// Uso: node scripts/fetch-planes.mjs

import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = 'https://votoinformado.jne.gob.pe/api/v1';
const DELAY_MS = 450;
const MAX_RETRIES = 4;
const OUT = 'data/planes.jsonl';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (/^id[A-Z]/.test(k)) continue;
      if (val === null || val === undefined || val === '') continue;
      const c = clean(val);
      if (Array.isArray(c) && c.length === 0) continue;
      out[k] = c;
    }
    return out;
  }
  return v;
}

async function fetchPlan(codigo) {
  let last;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}/plan-gobierno/resumen?codigoExpediente=${encodeURIComponent(codigo)}`, {
        headers: { accept: 'application/json' },
      });
      if (res.status === 404) return { noDisponible: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) return { noDisponible: true, mensaje: json.message };
      return clean(json.data);
    } catch (err) {
      last = err;
      await sleep(DELAY_MS * attempt * 3);
    }
  }
  return { error: String(last) };
}

async function main() {
  const raw = JSON.parse(await readFile('data/jne-puno-raw.json', 'utf8'));
  const codigos = [...new Set(raw.listas.map((l) => l.codigoExpediente).filter(Boolean))];

  await mkdir('data', { recursive: true });
  const hechas = new Set();
  if (existsSync(OUT)) {
    for (const line of (await readFile(OUT, 'utf8')).split('\n').filter(Boolean)) {
      try {
        const o = JSON.parse(line);
        if (!o.resultado?.error) hechas.add(o.codigoExpediente);
      } catch {}
    }
  }
  const pendientes = codigos.filter((c) => !hechas.has(c));
  console.log(`Planes únicos: ${codigos.length}. Ya descargados: ${hechas.size}. Por descargar: ${pendientes.length}`);

  let n = 0;
  let errores = 0;
  for (const codigo of pendientes) {
    n++;
    const resultado = await fetchPlan(codigo);
    if (resultado.error) errores++;
    await appendFile(OUT, JSON.stringify({ codigoExpediente: codigo, resultado }) + '\n');
    if (n % 25 === 0 || n === pendientes.length) {
      console.log(`  [${n}/${pendientes.length}] errores acumulados: ${errores}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nListo. Descargados ahora: ${n}, con error: ${errores}. Archivo: ${OUT}`);
}

main().catch((e) => {
  console.error('Fallo fatal:', e);
  process.exit(1);
});
