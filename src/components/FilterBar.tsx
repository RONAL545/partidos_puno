import type { Filtros, IndiceData } from '../types';

interface Props {
  indice: IndiceData;
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
}

// Los distritos capitales no eligen alcalde distrital: los gobierna la municipalidad
// provincial, así que el JNE no los lista. Se agregan para que el votante los encuentre;
// al elegirlos se muestran los cargos provinciales y regionales.
const CAPITALES: Record<string, string> = {
  Azángaro: 'Azángaro',
  Carabaya: 'Macusani',
  Chucuito: 'Juli',
  'El Collao': 'Ilave',
  Huancané: 'Huancané',
  Lampa: 'Lampa',
  Melgar: 'Ayaviri',
  Moho: 'Moho',
  Puno: 'Puno',
  'San Antonio de Putina': 'Putina',
  'San Román': 'Juliaca',
  Sandia: 'Sandia',
  Yunguyo: 'Yunguyo',
};

const select = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400';

export function FilterBar({ indice, filtros, onChange }: Props) {
  const provincias = Object.keys(indice.provincias);
  const distritos = filtros.provincia ? indice.provincias[filtros.provincia] ?? [] : [];
  const capital = filtros.provincia ? CAPITALES[filtros.provincia] : undefined;

  function set<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    const next = { ...filtros, [key]: value };
    if (key === 'provincia') next.distrito = '';
    onChange(next);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input
          type="text"
          placeholder="Buscar por nombre"
          value={filtros.busqueda}
          onChange={(e) => set('busqueda', e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
        />
        <select value={filtros.provincia} onChange={(e) => set('provincia', e.target.value)} className={select}>
          <option value="">Toda la región</option>
          {provincias.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={filtros.distrito}
          onChange={(e) => set('distrito', e.target.value)}
          disabled={!filtros.provincia}
          className={select}
        >
          <option value="">Todos los distritos</option>
          {capital && !distritos.includes(capital) && (
            <option value={capital}>{capital} (capital: alcaldía provincial)</option>
          )}
          {distritos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={filtros.cargo} onChange={(e) => set('cargo', e.target.value)} className={select}>
          <option value="">Todos los cargos</option>
          {indice.cargos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filtros.partido} onChange={(e) => set('partido', e.target.value)} className={select}>
          <option value="">Todas las organizaciones</option>
          {indice.partidos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>
          {filtros.provincia
            ? 'Al elegir una provincia o distrito se incluyen también los cargos que abarcan ese lugar (regionales y provinciales).'
            : 'Mostrando candidatos de toda la región Puno.'}
        </p>
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={filtros.incluirNoVigentes}
            onChange={(e) => set('incluirNoVigentes', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Incluir candidaturas no vigentes (excluidas, renuncias, improcedentes, tachadas)
        </label>
      </div>
    </div>
  );
}
