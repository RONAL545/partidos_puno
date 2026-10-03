import { useEffect, useState, type ReactNode } from 'react';
import type { CandidatoIndice, DetalleCandidato, PlanGobierno } from '../types';
import { cargarDetalle, cargarPlanes, pdfUrl } from '../data/store';
import { Foto } from './Foto';
import { Simbolo } from './Simbolo';
import { ubicacion } from './CandidatoCard';

interface Props {
  candidato: CandidatoIndice;
  onCerrar: () => void;
}

function edad(fecha: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
  if (!m) return null;
  const hoy = new Date();
  let años = hoy.getFullYear() - Number(m[3]);
  const cumplio =
    hoy.getMonth() + 1 > Number(m[2]) || (hoy.getMonth() + 1 === Number(m[2]) && hoy.getDate() >= Number(m[1]));
  if (!cumplio) años--;
  return años;
}

function periodo(desde: string | null, hasta: string | null) {
  if (desde && hasta) return `${desde} – ${hasta}`;
  if (desde) return `desde ${desde}`;
  if (hasta) return `hasta ${hasta}`;
  return '';
}

interface SentenciaVista {
  tipo: string;
  fecha?: string | null;
  materia?: string;
  fallo?: string;
  cumplimiento?: string;
  fuero?: string;
  expediente?: string;
  comentario: string | null;
}

function sentencias(d: DetalleCandidato): SentenciaVista[] {
  return [
    ...(d.sen?.penales ?? []).map((s) => ({ ...s, tipo: 'Penal' })),
    ...(d.sen?.obligaciones ?? []).map((s) => ({ ...s, tipo: 'Obligaciones (civil/laboral/familia)' })),
  ];
}

const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="font-semibold text-slate-800">{titulo}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

const vacio = (texto: string) => <p className="text-sm italic text-slate-400">{texto}</p>;

export function CandidatoDetalle({ candidato, onCerrar }: Props) {
  const [detalle, setDetalle] = useState<DetalleCandidato | undefined>();
  const [plan, setPlan] = useState<PlanGobierno | undefined>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    Promise.all([cargarDetalle(candidato.provincia, candidato.id), cargarPlanes()])
      .then(([d, planes]) => {
        if (!vigente) return;
        setDetalle(d);
        setPlan(candidato.lista ? planes[candidato.lista] : undefined);
      })
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [candidato]);

  useEffect(() => {
    const cerrarConEsc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', cerrarConEsc);
    return () => document.removeEventListener('keydown', cerrarConEsc);
  }, [onCerrar]);

  const años = detalle?.nac ? edad(detalle.nac.fecha) : null;
  const tieneHv = candidato.hv && detalle && (detalle.exp || detalle.edu || detalle.nac);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onCerrar}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Perfil de ${candidato.nombre}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Foto nombre={candidato.nombre} foto={candidato.foto} className="h-20 w-20 text-xl" />
            <Simbolo partido={candidato.partido} className="h-20 w-20" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{candidato.nombre}</h2>
              <p className="text-slate-600">
                {candidato.partido} · {candidato.cargo}
                {candidato.num ? ` (N.º ${candidato.num} de la lista)` : ''}
              </p>
              <p className="text-sm text-slate-500">
                {ubicacion(candidato)}
                {años !== null ? ` · ${años} años` : ''}
              </p>
              {detalle?.nac?.lugar && (
                <p className="text-sm text-slate-500">
                  Nació el {detalle.nac.fecha} en {detalle.nac.lugar}
                </p>
              )}
              {candidato.estado !== 'Inscrito' && (
                <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  Estado de la candidatura: {candidato.estado}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {cargando && <p className="mt-6 text-sm text-slate-500">Cargando hoja de vida…</p>}
        {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!cargando && !error && (
          <>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Los datos de esta ficha son los que el propio candidato declaró en su hoja de vida ante el Jurado
              Nacional de Elecciones (JNE). Esta plataforma no los verifica.
              {detalle?.pdf && (
                <>
                  {' '}
                  <a
                    href={pdfUrl(detalle.pdf)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-teal-700 underline"
                  >
                    Ver hoja de vida original (PDF)
                  </a>
                </>
              )}
            </p>

            {!tieneHv && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                El JNE no tiene publicada la hoja de vida de este candidato.
              </p>
            )}

            {tieneHv && detalle && (
              <>
                <Seccion titulo="Experiencia laboral">
                  {!detalle.exp?.length ? (
                    vacio('No declara experiencia laboral.')
                  ) : (
                    <ul className="space-y-1">
                      {detalle.exp.map((e, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          <span className="font-medium">{e.cargo ?? 'Cargo no indicado'}</span>
                          {e.centro ? ` — ${e.centro}` : ''}
                          {periodo(e.desde, e.hasta) ? ` (${periodo(e.desde, e.hasta)})` : ''}
                          {e.lugar ? <span className="text-slate-500"> · {e.lugar}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Seccion>

                <Seccion titulo="Formación académica">
                  {!detalle.edu?.length ? (
                    vacio('No declara formación académica.')
                  ) : (
                    <ul className="space-y-1">
                      {detalle.edu.map((e, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          <span className="font-medium">{e.nivel}</span>
                          {e.carrera ? `: ${e.carrera}` : ''}
                          {e.institucion ? ` — ${e.institucion}` : ''}
                          {e.estado ? ` · ${e.estado}` : ''}
                          {e.anio ? ` (${e.anio})` : ''}
                          {e.detalle ? <span className="text-slate-500"> · {e.detalle}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Seccion>

                <Seccion titulo="Trayectoria política">
                  {!detalle.pol?.length && !detalle.ren?.length ? (
                    vacio('No declara cargos partidarios, cargos de elección popular ni renuncias a partidos.')
                  ) : (
                    <ul className="space-y-1">
                      {detalle.pol?.map((c, i) => (
                        <li key={`p${i}`} className="text-sm text-slate-700">
                          <span className="font-medium">{c.cargo}</span> — {c.organizacion}
                          {periodo(c.desde, c.hasta) ? ` (${periodo(c.desde, c.hasta)})` : ''}
                          <span className="text-slate-500"> · {c.tipo}</span>
                        </li>
                      ))}
                      {detalle.ren?.map((r, i) => (
                        <li key={`r${i}`} className="text-sm text-slate-700">
                          Renunció a <span className="font-medium">{r.organizacion}</span>
                          {r.anio ? ` (${r.anio})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </Seccion>

                <Seccion titulo="Sentencias declaradas">
                  {!detalle.sen ? (
                    vacio('No declara sentencias penales ni por incumplimiento de obligaciones.')
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">
                        Una sentencia declarada puede haber sido absolutoria, anulada o estar en apelación: lee el
                        fallo y el comentario del propio candidato.
                      </p>
                      {sentencias(detalle).map((s, i) => (
                        <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-medium">
                            {s.tipo}
                            {s.fecha ? ` · ${s.fecha}` : ''}
                          </p>
                          {s.materia && <p>Materia: {s.materia}</p>}
                          {s.fallo && <p>Fallo: {s.fallo}</p>}
                          {s.cumplimiento && <p>Cumplimiento: {s.cumplimiento}</p>}
                          {s.fuero && <p className="text-slate-500">{s.fuero}</p>}
                          {s.expediente && <p className="text-slate-500">Expediente: {s.expediente}</p>}
                          {s.comentario && <p className="mt-1 italic text-slate-600">Comentario del candidato: {s.comentario}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Seccion>

                <Seccion titulo="Ingresos y patrimonio declarados">
                  {!detalle.pat ? (
                    vacio('No declara ingresos ni bienes.')
                  ) : (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {detalle.pat.ingreso && (
                        <li>
                          Ingresos {detalle.pat.ingreso.anio}: <span className="font-medium">{soles(detalle.pat.ingreso.total)}</span>
                        </li>
                      )}
                      {detalle.pat.inmuebles && (
                        <li>
                          Bienes inmuebles: {detalle.pat.inmuebles.n} (valor declarado{' '}
                          <span className="font-medium">{soles(detalle.pat.inmuebles.valor)}</span>)
                        </li>
                      )}
                      {detalle.pat.muebles && (
                        <li>
                          Bienes muebles (vehículos u otros): {detalle.pat.muebles.n} (valor declarado{' '}
                          <span className="font-medium">{soles(detalle.pat.muebles.valor)}</span>)
                        </li>
                      )}
                      {detalle.pat.acciones && (
                        <li>
                          Acciones o participaciones: {detalle.pat.acciones.n} (valor declarado{' '}
                          <span className="font-medium">{soles(detalle.pat.acciones.valor)}</span>)
                        </li>
                      )}
                    </ul>
                  )}
                </Seccion>

                {detalle.adicional && (
                  <Seccion titulo="Información adicional declarada">
                    <ul className="space-y-1">
                      {detalle.adicional.map((a, i) => (
                        <li key={i} className="whitespace-pre-line text-sm text-slate-700">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </Seccion>
                )}
              </>
            )}

            <Seccion titulo={`Plan de gobierno de ${candidato.partido}${plan?.tipo ? ` (${plan.tipo})` : ''}`}>
              {!plan ? (
                vacio('El JNE no tiene publicado un resumen del plan de gobierno de esta lista.')
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Es el plan de toda la lista de la organización, no de una persona en particular.
                    {plan.pdfCompleto && (
                      <>
                        {' '}
                        <a
                          href={pdfUrl(plan.pdfCompleto)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-teal-700 underline"
                        >
                          Plan completo (PDF)
                        </a>
                      </>
                    )}
                    {plan.pdfResumen && (
                      <>
                        {' · '}
                        <a
                          href={pdfUrl(plan.pdfResumen)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-teal-700 underline"
                        >
                          Resumen (PDF)
                        </a>
                      </>
                    )}
                  </p>
                  {plan.vision && <p className="text-sm text-slate-700">{plan.vision}</p>}
                  {plan.dimensiones.length === 0 && vacio('El resumen no trae propuestas por dimensión.')}
                  {plan.dimensiones.map((dim) => (
                    <details key={dim.nombre} className="rounded-lg border border-slate-200 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        {dim.nombre} ({dim.items.length})
                      </summary>
                      <ul className="mt-2 space-y-3">
                        {dim.items.map((it, i) => (
                          <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                            {it.problema && <p className="text-slate-500">Problema: {it.problema}</p>}
                            {it.objetivo && <p className="font-medium text-slate-800">Objetivo: {it.objetivo}</p>}
                            {it.meta && <p className="text-slate-700">Meta: {it.meta}</p>}
                            {it.indicador && <p className="text-xs text-slate-500">Indicador: {it.indicador}</p>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </Seccion>
          </>
        )}
      </div>
    </div>
  );
}
