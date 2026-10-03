// Los consejeros regionales se eligen por provincia, pero fetch-jne-puno.mjs pidió
// cada lista REGIONAL una sola vez (con la primera provincia que la descubrió), así
// que solo trajo los consejeros de esa provincia. Este script vuelve a pedir cada
// lista regional con cada una de las provincias del departamento y junta todos los
// candidatos (gobernador, vice y consejeros) en data/jne-puno-regional-por-provincia.json.
//
// Uso: node scripts/fetch-consejeros.mjs

import { readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://votoinformado.jne.gob.pe/api/v1';
const DELAY_MS = 450;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await sleep(DELAY_MS);
      return json;
    } catch (e) {
      last = e;
      await sleep(DELAY_MS * attempt * 3);
    }
  }
  throw last;
}

const post = (path, body) =>
  fetchJSON(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function main() {
  const raw = JSON.parse(await readFile('data/jne-puno-raw.json', 'utf8'));
  const dep = raw.departamento;
  const regionales = raw.listas.filter((l) => l.tipoEleccion === 'REGIONAL');
  const provincias = await fetchJSON(`${BASE}/departamentos/${dep.id}/provincias`);

  const porHojaVida = new Map();
  let llamadas = 0;
  for (const prov of provincias) {
    const distritos = await fetchJSON(`${BASE}/departamentos/${dep.id}/provincias/${prov.id}/distritos`);
    const dis = distritos[0].id;
    console.log(`Provincia ${prov.nombre}: ${regionales.length} listas regionales`);
    for (const lista of regionales) {
      llamadas++;
      const r = await post('/candidatos/organizaciones/candidatos', {
        dep: dep.id,
        pro: prov.id,
        dis,
        idSolicitudLista: lista.idSolicitudLista,
      });
      if (!r.success || !r.data) {
        console.warn(`  sin datos: ${lista.organizacionPolitica} / ${prov.nombre}: ${r.message}`);
        continue;
      }
      for (const bloque of r.data) {
        for (const org of bloque.organizaciones) {
          for (const l of org.listas) {
            for (const value of Object.values(l)) {
              if (!Array.isArray(value)) continue;
              for (const c of value) {
                const key = c.idHojaVida ?? `${c.cargoEleccion}-${c.apellidoPaterno}-${c.nombres}-${lista.idSolicitudLista}`;
                if (!porHojaVida.has(key)) {
                  porHojaVida.set(key, {
                    ...c,
                    idSolicitudLista: lista.idSolicitudLista,
                    codigoExpediente: lista.codigoExpediente,
                    organizacionPolitica: lista.organizacionPolitica,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  const candidatos = [...porHojaVida.values()];
  const porCargo = {};
  for (const c of candidatos) porCargo[c.cargoEleccion] = (porCargo[c.cargoEleccion] || 0) + 1;
  await writeFile(
    'data/jne-puno-regional-por-provincia.json',
    JSON.stringify({ generadoEl: new Date().toISOString(), candidatos }, null, 2),
  );
  console.log(`\nLlamadas: ${llamadas}. Candidatos regionales únicos: ${candidatos.length}`, porCargo);
}

main().catch((e) => {
  console.error('Fallo fatal:', e);
  process.exit(1);
});
