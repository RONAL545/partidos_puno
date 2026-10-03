// Genera los datos que consume la app (public/data/) a partir de lo descargado del JNE:
//   data/jne-puno-raw.json                     (listas + candidatos)
//   data/jne-puno-regional-por-provincia.json  (gobernador, vice y TODOS los consejeros regionales)
//   data/hojas-vida.jsonl                      (hoja de vida por candidato)
//   data/planes.jsonl                          (resumen del plan de gobierno por lista)
//
// Salida:
//   public/data/indice.json          todos los candidatos, campos livianos (para listar/filtrar)
//   public/data/detalle-<slug>.json  hoja de vida por candidato, un archivo por provincia (+ "region")
//   public/data/planes.json          plan de gobierno por codigoExpediente
//
// Uso: node scripts/build-data.mjs

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'public/data';

const PARTIDOS = {
  'AHORA NACION - AN': 'Ahora Nación',
  'ALIANZA ELECTORAL VENCEREMOS': 'Alianza Electoral Venceremos',
  'ALIANZA PARA EL PROGRESO': 'Alianza para el Progreso',
  'ASI - JUNTOS POR EL PERU': 'ASI – Juntos por el Perú',
  'FRENTE POPULAR AGRICOLA FIA DEL PERU': 'Frente Popular Agrícola FIA del Perú',
  'PARTIDO CIVICO OBRAS': 'Partido Cívico Obras',
  'PARTIDO DEMOCRATA VERDE': 'Partido Demócrata Verde',
  'PARTIDO DEMOCRATICO SOMOS PERU': 'Somos Perú',
  'PARTIDO FRENTE DE LA ESPERANZA 2021': 'Frente de la Esperanza 2021',
  'PARTIDO PAIS PARA TODOS': 'País para Todos',
  'PARTIDO POLITICO NACIONAL PERU LIBRE': 'Perú Libre',
  'PARTIDO POLITICO PERU PRIMERO': 'Perú Primero',
  'PARTIDO POLITICO PUEBLO CONSCIENTE': 'Pueblo Consciente',
  'PODEMOS PERU': 'Podemos Perú',
  PROGRESEMOS: 'Progresemos',
  'RENOVACION POPULAR PERU': 'Renovación Popular',
  'SALVEMOS AL PERU': 'Salvemos al Perú',
  'VIVA PUNO': 'Viva Puno',
};

const CARGO_ORDEN = {
  'GOBERNADOR REGIONAL': 0,
  'VICEGOBERNADOR REGIONAL': 1,
  'ALCALDE PROVINCIAL': 2,
  'ALCALDE DISTRITAL': 3,
  'CONSEJERO REGIONAL': 4,
  'REGIDOR PROVINCIAL': 5,
  'REGIDOR DISTRITAL': 6,
};

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'al', 'para', 'en']);

function titulo(s) {
  if (!s) return s;
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// El JNE entrega los nombres en mayúsculas y sin tildes. Solo se restauran tildes en
// nombres de pila muy comunes (nunca en apellidos, donde hay variantes con y sin tilde).
const NOMBRES_CON_TILDE = {
  jose: 'José', maria: 'María', jesus: 'Jesús', raul: 'Raúl', hernan: 'Hernán', ruben: 'Rubén',
  angel: 'Ángel', nestor: 'Néstor', tomas: 'Tomás', andres: 'Andrés', cesar: 'César', german: 'Germán',
  efrain: 'Efraín', rocio: 'Rocío', martin: 'Martín', victor: 'Víctor', ramon: 'Ramón', adan: 'Adán',
  ivan: 'Iván', julian: 'Julián', sebastian: 'Sebastián', sofia: 'Sofía', lucia: 'Lucía', monica: 'Mónica',
  veronica: 'Verónica', ines: 'Inés', belen: 'Belén', fatima: 'Fátima', elias: 'Elías', matias: 'Matías',
  isaias: 'Isaías', josue: 'Josué', noe: 'Noé', dario: 'Darío', hector: 'Héctor', oscar: 'Óscar',
  alvaro: 'Álvaro', gaston: 'Gastón', simon: 'Simón', wilmer: 'Wílmer', nicolas: 'Nicolás',
  fabian: 'Fabián', damian: 'Damián', maximo: 'Máximo',
};

function tituloNombres(s) {
  return titulo(s)
    .split(' ')
    .map((w) => NOMBRES_CON_TILDE[w.toLowerCase()] ?? w)
    .join(' ');
}

const partidoNombre = (n) => PARTIDOS[n] ?? titulo(n);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const si = (v) => String(v ?? '').trim().toUpperCase() === 'SI';
const t = (v) => (typeof v === 'string' ? v.trim() : v);

async function leerJsonl(file) {
  if (!existsSync(file)) return [];
  return (await readFile(file, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function estadoAcademico({ concluido, egresado, bachiller, titulado }) {
  if (titulado) return 'Titulado';
  if (bachiller) return 'Bachiller';
  if (egresado) return 'Egresado';
  if (concluido) return 'Concluido';
  return 'Sin concluir';
}

function construirDetalle(hv, rutaHojaVida) {
  const d = { pdf: rutaHojaVida ?? null };
  if (!hv || hv.noDisponible || hv.error) return d;

  const g = hv.datoGeneral ?? {};
  if (g.feNacimiento) {
    const lugar =
      g.paisNacimiento && g.paisNacimiento !== 'PERÚ'
        ? titulo(g.paisNacimiento)
        : [g.naciDistrito, g.naciProvincia, g.naciDepartamento].filter(Boolean).map(titulo).join(', ');
    d.nac = { fecha: g.feNacimiento, lugar: lugar || null };
  }
  if (g.desSexo) d.sexo = g.desSexo;
  if (g.txFeTerminoRegistro) d.inscrito = String(g.txFeTerminoRegistro).split(' ')[0];

  d.exp = (hv.experienciaLaboral ?? []).map((e) => ({
    centro: titulo(e.centroTrabajo),
    cargo: titulo(e.ocupacionProfesion),
    desde: e.anioTrabajoDesde ?? null,
    hasta: e.anioTrabajoHasta ?? null,
    lugar: [e.trabajoDistrito, e.trabajoProvincia].filter(Boolean).map(titulo).join(', ') || null,
  }));

  const fa = hv.formacionAcademica ?? {};
  const edu = [];
  const b = fa.educacionBasica;
  if (b) {
    const partes = [];
    if (b.eduPrimaria) partes.push(`Primaria ${si(b.concluidoEduPrimaria) ? 'concluida' : 'sin concluir'}`);
    if (b.eduSecundaria) partes.push(`Secundaria ${si(b.concluidoEduSecundaria) ? 'concluida' : 'sin concluir'}`);
    if (partes.length) edu.push({ nivel: 'Educación básica', detalle: partes.join(' · ') });
  }
  for (const e of fa.educacionTecnico ?? [])
    edu.push({
      nivel: 'Técnica',
      institucion: titulo(e.centroEstudio),
      carrera: titulo(e.carreraTecnico),
      estado: estadoAcademico({ concluido: si(e.concluidoEduTec), egresado: si(e.egresadoEduTec), titulado: si(e.tituloTec) }),
      anio: e.anioTitulo ?? null,
      detalle: t(e.txComentario) ?? null,
    });
  for (const e of fa.educacionNoUniversitaria ?? [])
    edu.push({
      nivel: 'No universitaria',
      institucion: titulo(e.centroEstudio),
      carrera: titulo(e.carreraNoUni),
      estado: estadoAcademico({ concluido: si(e.concluidoNoUni) }),
    });
  for (const e of fa.educacionUniversitaria ?? [])
    edu.push({
      nivel: 'Universitaria',
      institucion: titulo(e.universidad),
      carrera: titulo(e.carreraUni),
      estado: estadoAcademico({
        concluido: si(e.concluidoEduUni),
        egresado: si(e.egresadoEduUni),
        bachiller: si(e.bachillerEduUni),
        titulado: si(e.tituloUni),
      }),
      anio: e.anioTitulo ?? e.anioBachiller ?? null,
    });
  for (const e of fa.educacionPosgrado ?? [])
    edu.push({
      nivel: si(e.esDoctor) ? 'Doctorado' : 'Posgrado',
      institucion: titulo(e.txCenEstudioPosgrado),
      carrera: t(e.txEspecialidadPosgrado),
      estado: estadoAcademico({ concluido: si(e.concluidoPosgrado), egresado: si(e.egresadoPosgrado) }),
      anio: e.txAnioPosgrado ?? null,
    });
  for (const e of fa.educacionPosgradoOtro ?? [])
    edu.push({
      nivel: t(e.txGrado) ?? 'Posgrado',
      institucion: titulo(e.txCenEstudioPosgradoOtro),
      carrera: t(e.txEspecialidadPosgradoOtro),
      estado: estadoAcademico({ concluido: si(e.concluidoPosgradoOtro), egresado: si(e.egresadoPosgradoOtro) }),
      anio: e.txAnioPosgradoOtro ?? null,
    });
  d.edu = edu;

  const pol = [];
  for (const c of hv.trayectoria?.cargoPartidario ?? [])
    pol.push({
      tipo: 'Cargo partidario',
      cargo: titulo(c.cargoPartidario),
      organizacion: titulo(c.orgPolCargoPartidario),
      desde: c.anioCargoPartiDesde ?? null,
      hasta: c.anioCargoPartiHasta ?? null,
    });
  for (const c of hv.trayectoria?.cargoEleccion ?? [])
    pol.push({
      tipo: 'Cargo de elección popular',
      cargo: titulo(c.cargoEleccion),
      organizacion: titulo(c.orgPolCargoElec),
      desde: c.anioCargoElecDesde ?? null,
      hasta: c.anioCargoElecHasta ?? null,
    });
  d.pol = pol;

  d.ren = (hv.renunciaEfectuada ?? []).map((r) => ({
    organizacion: titulo(r.orgPolRenunciaOp),
    anio: r.anioRenunciaOp ?? r.anioRenuncia ?? null,
  }));

  // Sentencias: son declaradas por el propio candidato en su hoja de vida (no las verifica esta app).
  const penales = (hv.sentenciaPenal ?? []).map((s) => ({
    fuero: t(s.fuero),
    expediente: t(s.expediente),
    fecha: s.fecSentencia ?? null,
    fallo: t(s.fallo),
    materia: t(s.materia),
    cumplimiento: t(s.cumplimientoPena),
    comentario: t(s.txComentario) ?? null,
  }));
  const obligaciones = (hv.sentenciaObliga ?? []).map((s) => ({
    fuero: t(s.fuero),
    expediente: t(s.expediente),
    fallo: t(s.fallo),
    materia: t(s.materia),
    comentario: t(s.txComentario) ?? null,
  }));
  if (penales.length || obligaciones.length) d.sen = { penales, obligaciones };

  // Patrimonio declarado: solo totales (sin direcciones ni placas).
  const dj = hv.declaracionJurada ?? {};
  const ingresos = dj.ingreso ?? [];
  const ult = [...ingresos].sort((a, b) => num(b.anioIngresos) - num(a.anioIngresos))[0];
  const inm = dj.bienInmueble ?? [];
  const mue = dj.bienMueble ?? [];
  const tit = dj.titularidad ?? [];
  const pat = {};
  if (ult) pat.ingreso = { anio: ult.anioIngresos, total: num(ult.totalIngresos) };
  if (inm.length) pat.inmuebles = { n: inm.length, valor: inm.reduce((a, x) => a + (num(x.flValor) || num(x.autovaluo)), 0) };
  if (mue.length) pat.muebles = { n: mue.length, valor: mue.reduce((a, x) => a + num(x.valor), 0) };
  if (tit.length) pat.acciones = { n: tit.length, valor: tit.reduce((a, x) => a + num(x.flValor), 0) };
  if (Object.keys(pat).length) d.pat = pat;

  const adic = (hv.informacionAdicional ?? []).map((a) => t(a.infoAdicional)).filter(Boolean);
  if (adic.length) d.adicional = adic;

  return d;
}

async function main() {
  const raw = JSON.parse(await readFile('data/jne-puno-raw.json', 'utf8'));
  const regional = existsSync('data/jne-puno-regional-por-provincia.json')
    ? JSON.parse(await readFile('data/jne-puno-regional-por-provincia.json', 'utf8')).candidatos
    : null;

  // hojas de vida (la última entrada válida por id gana)
  const hojas = new Map();
  for (const { idHojaVida, resultado } of await leerJsonl('data/hojas-vida.jsonl')) {
    if (!resultado.error || !hojas.has(idHojaVida)) hojas.set(idHojaVida, resultado);
  }

  // planes
  const planesRaw = new Map();
  for (const { codigoExpediente, resultado } of await leerJsonl('data/planes.jsonl')) {
    if (!resultado.error || !planesRaw.has(codigoExpediente)) planesRaw.set(codigoExpediente, resultado);
  }

  // candidatos: municipales desde raw; regionales (gobernador/vice/consejeros) desde el archivo por provincia
  const registros = [];
  for (const lista of raw.listas) {
    if (lista.tipoEleccion === 'REGIONAL' && regional) continue;
    for (const c of lista.candidatos) registros.push({ c, lista });
  }
  if (regional) {
    for (const c of regional) {
      registros.push({
        c,
        lista: { codigoExpediente: c.codigoExpediente, organizacionPolitica: c.organizacionPolitica, idSolicitudLista: c.idSolicitudLista },
      });
    }
  }

  const indice = [];
  const detallesPorSlug = new Map();
  const vistos = new Set();

  for (const { c, lista } of registros) {
    const id = c.idHojaVida ?? `s${lista.idSolicitudLista}-${c.numeroCandidato}-${c.ubigeo}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    const hv = c.idHojaVida ? hojas.get(c.idHojaVida) : null;
    const foto = hv?.datoGeneral?.txGuidFoto ?? null;
    const provincia = c.provincia ? titulo(c.provincia) : null;
    const distrito = c.distrito ? titulo(c.distrito) : null;
    // Las candidaturas excluidas o renunciadas pueden venir sin datos personales (el JNE los retira).
    const nombre = c.nombres
      ? `${tituloNombres(c.nombres)} ${titulo(`${c.apellidoPaterno ?? ''} ${c.apellidoMaterno ?? ''}`.replace(/\s+/g, ' '))}`.trim()
      : 'Sin datos publicados';

    indice.push({
      id,
      nombre,
      partido: partidoNombre(lista.organizacionPolitica),
      cargo: titulo(c.cargoEleccion),
      provincia,
      distrito,
      estado: c.estadoCandidato === 'EXCLUSION' ? 'Exclusión' : titulo(c.estadoCandidato),
      num: c.numeroCandidato ?? null,
      lista: lista.codigoExpediente ?? null,
      foto,
      hv: Boolean(hv && !hv.noDisponible && !hv.error),
      _orden: [CARGO_ORDEN[c.cargoEleccion] ?? 9, provincia ?? '', distrito ?? '', lista.organizacionPolitica, c.numeroCandidato ?? 0],
    });

    const clave = provincia ? slug(provincia) : 'region';
    if (!detallesPorSlug.has(clave)) detallesPorSlug.set(clave, {});
    detallesPorSlug.get(clave)[id] = construirDetalle(hv, c.rutaHojaVida);
  }

  indice.sort((a, b) => {
    for (let i = 0; i < a._orden.length; i++) {
      if (a._orden[i] < b._orden[i]) return -1;
      if (a._orden[i] > b._orden[i]) return 1;
    }
    return 0;
  });
  for (const r of indice) delete r._orden;

  // ubicación: provincias -> distritos con candidatos
  const provincias = {};
  for (const r of indice) {
    if (!r.provincia) continue;
    provincias[r.provincia] ??= new Set();
    if (r.distrito) provincias[r.provincia].add(r.distrito);
  }
  const provinciasOut = Object.fromEntries(
    Object.keys(provincias)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((p) => [p, [...provincias[p]].sort((a, b) => a.localeCompare(b, 'es'))]),
  );

  // planes de gobierno
  const planes = {};
  const dimensionesSet = new Set();
  const clavesExtra = new Set();
  for (const [codigo, p] of planesRaw) {
    if (p.noDisponible || p.error) continue;
    for (const k of Object.keys(p)) if (!['datoGeneral', 'dimensiones'].includes(k)) clavesExtra.add(k);
    const dimensiones = (p.dimensiones ?? []).map((dim) => {
      dimensionesSet.add(dim.txDimension);
      return {
        nombre: dim.txDimension,
        items: (dim.detalle ?? []).map((x) => ({
          problema: x.txPgProblema ?? null,
          objetivo: x.txPgObjetivo ?? null,
          meta: x.txPgMeta ?? null,
          indicador: x.txPgIndicador ?? null,
        })),
      };
    });
    planes[codigo] = {
      partido: partidoNombre(p.datoGeneral?.txOrganizacionPolitica ?? ''),
      tipo: p.datoGeneral?.txTipoEleccion ? titulo(p.datoGeneral.txTipoEleccion) : null,
      pdfCompleto: p.datoGeneral?.txRutaCompleto ?? null,
      pdfResumen: p.datoGeneral?.txRutaResumen ?? null,
      vision: p.datoGeneral?.txVision ?? null,
      ideario: p.datoGeneral?.txIdeario ?? null,
      dimensiones,
    };
  }

  if (existsSync(OUT)) await rm(OUT, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const cargos = [...new Set(indice.map((r) => r.cargo))].sort((a, b) => (CARGO_ORDEN[a.toUpperCase()] ?? 9) - (CARGO_ORDEN[b.toUpperCase()] ?? 9));
  await writeFile(
    `${OUT}/indice.json`,
    JSON.stringify({
      generadoEl: new Date().toISOString(),
      fuente: 'JNE - Voto Informado (https://votoinformado.jne.gob.pe), proceso ERM 2026',
      provincias: provinciasOut,
      cargos,
      partidos: [...new Set(indice.map((r) => r.partido))].sort((a, b) => a.localeCompare(b, 'es')),
      estados: [...new Set(indice.map((r) => r.estado))],
      dimensiones: [...dimensionesSet],
      candidatos: indice,
    }),
  );
  for (const [clave, det] of detallesPorSlug) await writeFile(`${OUT}/detalle-${clave}.json`, JSON.stringify(det));
  await writeFile(`${OUT}/planes.json`, JSON.stringify(planes));

  const porEstado = {};
  for (const r of indice) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
  const conHv = indice.filter((r) => r.hv).length;
  console.log(`Candidatos en el índice: ${indice.length} (con hoja de vida descargada: ${conHv})`);
  console.log('Por estado:', porEstado);
  console.log(`Provincias: ${Object.keys(provinciasOut).length}. Planes de gobierno: ${Object.keys(planes).length}. Dimensiones:`, [...dimensionesSet]);
  if (clavesExtra.size) console.log('Claves extra en planes (no usadas):', [...clavesExtra]);
}

main().catch((e) => {
  console.error('Fallo fatal:', e);
  process.exit(1);
});
