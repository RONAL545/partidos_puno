// Descarga la hoja de vida estructurada (JSON) de cada candidato listado en
// data/jne-puno-raw.json, desde la API pública de https://votoinformado.jne.gob.pe
//   GET /api/v1/candidatos/hoja-vida/{idHojaVida}
//
// - Una petición a la vez, con pausa (DELAY_MS) para no cargar el servidor del JNE.
// - Reanudable: cada hoja de vida se guarda en data/hojas-vida.jsonl apenas se
//   descarga; si se interrumpe, al relanzar se saltan las ya descargadas.
// - No se guarda el DNI (numeroDocumento) ni campos internos (id*, tengo*, item*).
//
// Uso: node scripts/fetch-hojas-vida.mjs [--limit=N]

import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://votoinformado.jne.gob.pe/api/v1';
const DELAY_MS = 450;
const MAX_RETRIES = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (/^id[A-Z]/.test(k) || /^tengo/.test(k) || /^item/.test(k)) continue;
      if (k === 'numeroDocumento' || k === 'carneExtranjeria') continue;
      if (val === null || val === undefined || val === '' || val === ' ') continue;
      const c = clean(val);
      if (Array.isArray(c) && c.length === 0) continue;
      if (c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0) continue;
      out[k] = c;
    }
    return out;
  }
  return v;
}

async function fetchHojaVida(id) {
  let last;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}/candidatos/hoja-vida/${encodeURIComponent(id)}`, {
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
  const ids = [];
  const seen = new Set();
  for (const lista of raw.listas) {
    for (const c of lista.candidatos) {
      if (c.idHojaVida && !seen.has(c.idHojaVida)) {
        seen.add(c.idHojaVida);
        ids.push(c.idHojaVida);
      }
    }
  }

  const extra = 'data/jne-puno-regional-por-provincia.json';
  if (existsSync(extra)) {
    for (const c of JSON.parse(await readFile(extra, 'utf8')).candidatos) {
      if (c.idHojaVida && !seen.has(c.idHojaVida)) {
        seen.add(c.idHojaVida);
        ids.push(c.idHojaVida);
      }
    }
  }

  const outFile = path.join('data', 'hojas-vida.jsonl');
  await mkdir('data', { recursive: true });
  const hechas = new Set();
  if (existsSync(outFile)) {
    const lines = (await readFile(outFile, 'utf8')).split('\n').filter(Boolean);
    for (const l of lines) {
      try {
        const o = JSON.parse(l);
        if (!o.resultado?.error) hechas.add(o.idHojaVida);
      } catch {}
    }
  }

  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  // --part=i/n: reparte el trabajo entre n procesos (este toma los ids con índice % n === i)
  const partArg = process.argv.find((a) => a.startsWith('--part='));
  const [partI, partN] = partArg ? partArg.split('=')[1].split('/').map(Number) : [0, 1];
  const pendientes = ids
    .filter((id, idx) => idx % partN === partI && !hechas.has(id))
    .slice(0, limit);
  console.log(`Hojas de vida únicas: ${ids.length}. Ya descargadas: ${hechas.size}. Por descargar: ${pendientes.length}`);

  let n = 0;
  let errores = 0;
  for (const id of pendientes) {
    n++;
    const resultado = await fetchHojaVida(id);
    if (resultado.error) errores++;
    await appendFile(outFile, JSON.stringify({ idHojaVida: id, resultado }) + '\n');
    if (n % 25 === 0 || n === pendientes.length) {
      console.log(`  [${n}/${pendientes.length}] errores acumulados: ${errores}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nListo. Descargadas ahora: ${n}, con error: ${errores}. Archivo: ${outFile}`);
}

main().catch((e) => {
  console.error('Fallo fatal:', e);
  process.exit(1);
});
