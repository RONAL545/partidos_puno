// Descarga candidatos oficiales del JNE (API de votoinformado.jne.gob.pe) para
// TODO el departamento de Puno: 13 provincias, ~110 distritos.
//
// Fuente: endpoints reversados manualmente el 17/09/2026 observando la red del
// sitio público https://votoinformado.jne.gob.pe (ver DATA_SOURCES que se genera
// junto a este script). No requiere resolver CAPTCHA — son los mismos endpoints
// que usa el sitio público para cualquier visitante.
//
// Uso: node scripts/fetch-jne-puno.mjs
//
// Respeta el servidor del JNE: una sola petición a la vez, con pausa entre cada
// una y reintentos con backoff si falla. Para un departamento completo esto
// tarda varios minutos — es intencional.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://votoinformado.jne.gob.pe/api/v1';
const DELAY_MS = 400;
const MAX_RETRIES = 3;
const DEPARTAMENTO_NOMBRE = 'PUNO';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { accept: 'application/json', ...(options.headers || {}) },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} en ${url}`);
      }
      const json = await res.json();
      await sleep(DELAY_MS);
      return json;
    } catch (err) {
      lastError = err;
      console.warn(`  reintento ${attempt}/${MAX_RETRIES} tras error: ${err.message}`);
      await sleep(DELAY_MS * attempt * 2);
    }
  }
  throw lastError;
}

function getDepartamentos() {
  return fetchJSON(`${BASE}/departamentos`);
}

function getProvincias(depId) {
  return fetchJSON(`${BASE}/departamentos/${depId}/provincias`);
}

function getDistritos(depId, provId) {
  return fetchJSON(`${BASE}/departamentos/${depId}/provincias/${provId}/distritos`);
}

function getOrganizaciones(dep, pro, dis) {
  // OJO: los campos del body son "pro" y "dis", NO "prov"/"dist". Si se manda
  // el nombre equivocado, el backend NO da error — los ignora en silencio y
  // responde solo con lo que depende de "dep" (o sea, solo REGIONAL). Así
  // pasó en la primera versión de este script: parecía funcionar (HTTP 200)
  // pero devolvía datos incompletos sin avisar. Verificado 17/09/2026.
  return fetchJSON(`${BASE}/candidatos/organizaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dep, pro, dis }),
  });
}

function getCandidatosDeLista(dep, pro, dis, idSolicitudLista) {
  return fetchJSON(`${BASE}/candidatos/organizaciones/candidatos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dep, pro, dis, idSolicitudLista }),
  });
}

async function main() {
  console.log(`Buscando departamento "${DEPARTAMENTO_NOMBRE}"...`);
  const departamentos = await getDepartamentos();
  const dep = departamentos.find((d) => d.nombre === DEPARTAMENTO_NOMBRE);
  if (!dep) throw new Error(`No se encontró el departamento ${DEPARTAMENTO_NOMBRE}`);
  console.log(`Departamento: ${dep.nombre} (id=${dep.id})`);

  let provincias = await getProvincias(dep.id);
  console.log(`${provincias.length} provincias encontradas.`);

  const limitArg = process.argv.find((a) => a.startsWith('--limit-provincias='));
  if (limitArg) {
    const n = Number(limitArg.split('=')[1]);
    provincias = provincias.slice(0, n);
    console.log(`(modo prueba: limitado a las primeras ${provincias.length} provincias)`);
  }

  // Mapa idSolicitudLista -> metadata + tupla (dep,prov,dist) usada para descubrirla,
  // para no pedir la misma lista dos veces (regional y provincial se repiten en
  // cada distrito consultado).
  const listasPorId = new Map();

  let distritosVisitados = 0;
  for (const prov of provincias) {
    const distritos = await getDistritos(dep.id, prov.id);
    console.log(`\nProvincia ${prov.nombre} (id=${prov.id}): ${distritos.length} distritos`);

    for (const dist of distritos) {
      distritosVisitados++;
      console.log(`  [${distritosVisitados}] ${prov.nombre} / ${dist.nombre} (dist=${dist.id})`);
      let orgData;
      try {
        orgData = await getOrganizaciones(dep.id, prov.id, dist.id); // (dep, pro, dis)
      } catch (err) {
        console.warn(`    ERROR consultando organizaciones: ${err.message}`);
        continue;
      }
      if (!orgData.success || !orgData.data) {
        console.warn(`    sin datos: ${orgData.message}`);
        continue;
      }
      for (const bloque of orgData.data) {
        for (const org of bloque.organizaciones) {
          for (const lista of org.listas) {
            if (!listasPorId.has(lista.idSolicitudLista)) {
              listasPorId.set(lista.idSolicitudLista, {
                idTipoEleccion: bloque.idTipoEleccion,
                tipoEleccion: bloque.tipoEleccion,
                idOrganizacionPolitica: org.idOrganizacionPolitica,
                organizacionPolitica: org.organizacionPolitica,
                URLlogoOP: org.URLlogoOP,
                idSolicitudLista: lista.idSolicitudLista,
                codigoExpediente: lista.codigoExpediente,
                rutaPlanGobierno: lista.rutaPlanGobierno ?? null,
                // tupla usada para descubrir esta lista; la reusamos tal cual al
                // pedir sus candidatos, porque el backend del JNE la exige
                // igual a la que se usó para listar organizaciones.
                dep: dep.id,
                prov: prov.id,
                dist: dist.id,
                provNombre: prov.nombre,
                distNombre: dist.nombre,
              });
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal de listas únicas a consultar: ${listasPorId.size}`);

  const candidatosPorLista = [];
  let i = 0;
  for (const lista of listasPorId.values()) {
    i++;
    console.log(
      `  [${i}/${listasPorId.size}] ${lista.tipoEleccion} - ${lista.organizacionPolitica} (${lista.provNombre}${
        lista.tipoEleccion === 'MUNICIPAL DISTRITAL' ? ' / ' + lista.distNombre : ''
      })`,
    );
    let candData;
    try {
      candData = await getCandidatosDeLista(lista.dep, lista.prov, lista.dist, lista.idSolicitudLista);
    } catch (err) {
      console.warn(`    ERROR consultando candidatos: ${err.message}`);
      candidatosPorLista.push({ ...lista, error: err.message, candidatos: [] });
      continue;
    }
    if (!candData.success || !candData.data) {
      console.warn(`    sin candidatos: ${candData.message}`);
      candidatosPorLista.push({ ...lista, sinDatos: candData.message, candidatos: [] });
      continue;
    }
    // La respuesta repite la forma de /organizaciones pero con los candidatos
    // ya resueltos dentro de cada lista. El nombre del array cambia según el
    // tipo de elección (p.ej. REGIONAL trae "gobernadores"+"consejeros" por
    // separado; MUNICIPAL PROVINCIAL/DISTRITAL trae todo en "candidatos") —
    // en vez de adivinar cada nombre, se toma cualquier campo que sea array.
    const candidatos = [];
    for (const bloque of candData.data) {
      for (const org of bloque.organizaciones) {
        for (const l of org.listas) {
          for (const value of Object.values(l)) {
            if (Array.isArray(value)) candidatos.push(...value);
          }
        }
      }
    }
    candidatosPorLista.push({ ...lista, candidatos });
  }

  const outDir = path.join(process.cwd(), 'data');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'jne-puno-raw.json');
  await writeFile(
    outFile,
    JSON.stringify(
      {
        generadoEl: new Date().toISOString(),
        fuente: 'https://votoinformado.jne.gob.pe (API pública, endpoints reversados manualmente)',
        departamento: dep,
        listas: candidatosPorLista,
      },
      null,
      2,
    ),
  );

  const totalCandidatos = candidatosPorLista.reduce((acc, l) => acc + l.candidatos.length, 0);
  const porTipo = {};
  for (const l of candidatosPorLista) {
    porTipo[l.tipoEleccion] = (porTipo[l.tipoEleccion] || 0) + l.candidatos.length;
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Provincias: ${provincias.length}`);
  console.log(`Distritos visitados: ${distritosVisitados}`);
  console.log(`Listas (organización x elección): ${listasPorId.size}`);
  console.log(`Candidatos totales (todos los cargos, incl. vice/consejeros/regidores): ${totalCandidatos}`);
  console.log('Por tipo de elección:', porTipo);
  console.log(`\nGuardado en: ${outFile}`);
}

main().catch((err) => {
  console.error('Fallo fatal:', err);
  process.exit(1);
});
