import { useEffect, useState } from 'react';
import type { CandidatoIndice, ItemPlan, Planes } from '../types';
import { cargarPlanes } from '../data/store';
import { ubicacion } from './CandidatoCard';
import { Simbolo } from './Simbolo';

interface Props {
  candidatos: CandidatoIndice[];
  dimensiones: string[];
  onQuitar: (id: string) => void;
}

function itemsDe(planes: Planes | null, c: CandidatoIndice, dimension: string): ItemPlan[] {
  const plan = c.lista && planes ? planes[c.lista] : undefined;
  return plan?.dimensiones.find((d) => d.nombre === dimension)?.items ?? [];
}

const textoItem = (i: ItemPlan) => `${i.objetivo ?? i.problema ?? ''}${i.meta ? ` (Meta: ${i.meta})` : ''}`;

export function ComparadorPanel({ candidatos, dimensiones, onQuitar }: Props) {
  const [tema, setTema] = useState('');
  const [planes, setPlanes] = useState<Planes | null>(null);
  const [errorPlanes, setErrorPlanes] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (candidatos.length < 2 || planes) return;
    cargarPlanes()
      .then(setPlanes)
      .catch((e: Error) => setErrorPlanes(e.message));
  }, [candidatos.length, planes]);

  if (candidatos.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Selecciona 2 o 3 candidatos con la casilla "Comparar" para ver sus planes de gobierno lado a lado.
      </div>
    );
  }

  const dimensionesMostradas = tema ? [tema] : dimensiones;

  async function pedirVeredicto() {
    if (candidatos.length !== 2) return;
    setCargando(true);
    setError(null);
    setAnalisis(null);
    const [a, b] = candidatos;
    const propuestas = (c: CandidatoIndice) =>
      dimensionesMostradas.flatMap((d) => itemsDe(planes, c, d).map((i) => `[${d}] ${textoItem(i)}`));
    try {
      const res = await fetch('/api/comparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tema: tema || 'general',
          candidatoA: { nombre: a.nombre, partido: a.partido, propuestas: propuestas(a) },
          candidatoB: { nombre: b.nombre, partido: b.partido, propuestas: propuestas(b) },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al generar el análisis');
      }
      const data = await res.json();
      setAnalisis(data.analisis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Comparador ({candidatos.length} candidatos)</h2>
        <select
          value={tema}
          onChange={(e) => {
            setTema(e.target.value);
            setAnalisis(null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todas las dimensiones</option>
          {dimensiones.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {candidatos.map((c) => (
          <span key={c.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {c.nombre}
            <button onClick={() => onQuitar(c.id)} className="text-slate-400 hover:text-slate-700" aria-label={`Quitar a ${c.nombre}`}>
              ✕
            </button>
          </span>
        ))}
      </div>

      {errorPlanes && <p className="text-sm text-red-600">{errorPlanes}</p>}
      {!planes && !errorPlanes && <p className="text-sm text-slate-500">Cargando planes de gobierno…</p>}

      {planes && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-32 border-b border-slate-200 p-2 text-left text-slate-500">Dimensión</th>
                {candidatos.map((c) => (
                  <th key={c.id} className="border-b border-slate-200 p-2 text-left">
                    <Simbolo partido={c.partido} className="mb-1 h-10 w-10" />
                    {c.nombre}
                    <div className="font-normal text-slate-500">{c.partido}</div>
                    <div className="font-normal text-slate-400">
                      {c.cargo} · {ubicacion(c)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimensionesMostradas.map((d) => (
                <tr key={d}>
                  <td className="border-b border-slate-100 p-2 align-top font-medium text-slate-600">{d}</td>
                  {candidatos.map((c) => {
                    const items = itemsDe(planes, c, d);
                    return (
                      <td key={c.id} className="border-b border-slate-100 p-2 align-top">
                        {items.length === 0 ? (
                          <span className="text-slate-400">Sin propuestas registradas</span>
                        ) : (
                          items.map((it, i) => (
                            <div key={i} className="mb-2">
                              <p className="font-medium text-slate-800">{it.objetivo ?? it.problema}</p>
                              {it.meta && <p className="text-slate-600">Meta: {it.meta}</p>}
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg bg-teal-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-teal-900">Análisis con IA</h3>
            <p className="text-xs text-teal-700">Opinión generada automáticamente, no es una posición oficial de la plataforma.</p>
          </div>
          <button
            onClick={pedirVeredicto}
            disabled={candidatos.length !== 2 || cargando || !planes}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {cargando ? 'Analizando…' : 'Pedir veredicto de IA'}
          </button>
        </div>
        {candidatos.length !== 2 && (
          <p className="mt-2 text-xs text-teal-700">El veredicto de IA compara exactamente 2 candidatos a la vez.</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {analisis && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800">{analisis}</p>}
      </div>
    </div>
  );
}
