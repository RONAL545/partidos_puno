import type { CandidatoIndice } from '../types';
import { Foto } from './Foto';
import { Simbolo } from './Simbolo';

interface Props {
  candidato: CandidatoIndice;
  seleccionado: boolean;
  puedeSeleccionar: boolean;
  onToggleComparar: (id: string) => void;
  onVerDetalle: (id: string) => void;
}

export function ubicacion(c: CandidatoIndice) {
  return c.provincia ? `${c.provincia}${c.distrito ? ` · ${c.distrito}` : ''}` : 'Toda la región Puno';
}

export function CandidatoCard({ candidato, seleccionado, puedeSeleccionar, onToggleComparar, onVerDetalle }: Props) {
  const vigente = candidato.estado === 'Inscrito';
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Foto nombre={candidato.nombre} foto={candidato.foto} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900" title={candidato.nombre}>
            {candidato.nombre}
          </h3>
          <p className="truncate text-sm text-slate-600" title={candidato.partido}>
            {candidato.partido}
          </p>
          {!vigente && (
            <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
              Candidatura: {candidato.estado}
            </span>
          )}
        </div>
        <Simbolo partido={candidato.partido} />
      </div>

      <div className="text-sm text-slate-600">
        <p className="font-medium text-slate-700">{candidato.cargo}</p>
        <p>{ubicacion(candidato)}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={seleccionado}
            disabled={!seleccionado && !puedeSeleccionar}
            onChange={() => onToggleComparar(candidato.id)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Comparar
        </label>
        <button
          onClick={() => onVerDetalle(candidato.id)}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          Ver perfil
        </button>
      </div>
    </div>
  );
}
