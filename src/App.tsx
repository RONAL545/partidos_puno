import { useEffect, useMemo, useState } from 'react';
import { cargarIndice } from './data/store';
import { FilterBar } from './components/FilterBar';
import { CandidatoCard } from './components/CandidatoCard';
import { CandidatoDetalle } from './components/CandidatoDetalle';
import { ComparadorPanel } from './components/ComparadorPanel';
import type { Filtros, IndiceData } from './types';

const FILTROS_INICIALES: Filtros = {
  provincia: '',
  distrito: '',
  cargo: '',
  partido: '',
  busqueda: '',
  incluirNoVigentes: false,
};

const MAX_COMPARAR = 3;
const POR_PAGINA = 48;

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function App() {
  const [indice, setIndice] = useState<IndiceData | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [comparandoIds, setComparandoIds] = useState<string[]>([]);

  useEffect(() => {
    cargarIndice()
      .then(setIndice)
      .catch((e: Error) => setErrorCarga(e.message));
  }, []);

  useEffect(() => setMostrar(POR_PAGINA), [filtros]);

  const candidatosFiltrados = useMemo(() => {
    if (!indice) return [];
    const q = sinTildes(filtros.busqueda.trim());
    return indice.candidatos.filter((c) => {
      if (!filtros.incluirNoVigentes && c.estado !== 'Inscrito') return false;
      // Los cargos sin provincia (regionales) o sin distrito (provinciales) abarcan el lugar elegido.
      if (filtros.provincia && c.provincia !== null && c.provincia !== filtros.provincia) return false;
      if (filtros.distrito && c.distrito !== null && c.distrito !== filtros.distrito) return false;
      if (filtros.cargo && c.cargo !== filtros.cargo) return false;
      if (filtros.partido && c.partido !== filtros.partido) return false;
      if (q && !sinTildes(c.nombre).includes(q)) return false;
      return true;
    });
  }, [indice, filtros]);

  const porId = useMemo(() => new Map(indice?.candidatos.map((c) => [c.id, c]) ?? []), [indice]);
  const detalle = detalleId ? porId.get(detalleId) ?? null : null;
  const candidatosComparando = comparandoIds
    .map((id) => porId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  function toggleComparar(id: string) {
    setComparandoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_COMPARAR ? [...prev, id] : prev,
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-2xl font-bold text-slate-900">🗳️ Voto Informado Puno</h1>
          <p className="text-sm text-slate-600">
            Elecciones Regionales y Municipales 2026: conoce a los candidatos, su hoja de vida y sus planes de
            gobierno, y compáralos antes de votar.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {errorCarga && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorCarga}</p>}
        {!indice && !errorCarga && <p className="text-sm text-slate-500">Cargando candidatos…</p>}

        {indice && (
          <>
            <FilterBar indice={indice} filtros={filtros} onChange={setFiltros} />

            <ComparadorPanel
              candidatos={candidatosComparando}
              dimensiones={indice.dimensiones}
              onQuitar={(id) => setComparandoIds((prev) => prev.filter((x) => x !== id))}
            />

            <div>
              <p className="mb-2 text-sm text-slate-500">
                {candidatosFiltrados.length.toLocaleString('es-PE')} candidato(s) encontrado(s)
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {candidatosFiltrados.slice(0, mostrar).map((c) => (
                  <CandidatoCard
                    key={c.id}
                    candidato={c}
                    seleccionado={comparandoIds.includes(c.id)}
                    puedeSeleccionar={comparandoIds.length < MAX_COMPARAR}
                    onToggleComparar={toggleComparar}
                    onVerDetalle={setDetalleId}
                  />
                ))}
              </div>
              {mostrar < candidatosFiltrados.length && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setMostrar((m) => m + POR_PAGINA)}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Mostrar más ({(candidatosFiltrados.length - mostrar).toLocaleString('es-PE')} restantes)
                  </button>
                </div>
              )}
            </div>

            <footer className="pb-8 text-xs text-slate-500">
              Fuente: {indice.fuente}. Datos descargados el{' '}
              {new Date(indice.generadoEl).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.
              La situación de cada candidatura puede cambiar hasta el día de la elección (4 de octubre de 2026):
              confírmala en{' '}
              <a href="https://votoinformado.jne.gob.pe" target="_blank" rel="noreferrer" className="underline">
                votoinformado.jne.gob.pe
              </a>
              .
            </footer>
          </>
        )}
      </main>

      {detalle && <CandidatoDetalle candidato={detalle} onCerrar={() => setDetalleId(null)} />}
    </div>
  );
}
