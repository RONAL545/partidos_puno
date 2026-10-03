import { useState } from 'react';

// Símbolos de las organizaciones políticas que postulan en Puno (ERM 2026).
// Imágenes descargadas del JNE (sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo/<id>)
// y guardadas en public/simbolos/<idOrganizacionPolitica>.jpg
const ID_ORGANIZACION: Record<string, number> = {
  'Ahora Nación': 2980,
  'Alianza Electoral Venceremos': 3028,
  'Alianza para el Progreso': 1257,
  'ASI – Juntos por el Perú': 3038,
  'Frente de la Esperanza 2021': 2857,
  'Frente Popular Agrícola FIA del Perú': 2901,
  'País para Todos': 2956,
  'Partido Cívico Obras': 2941,
  'Partido Demócrata Verde': 2895,
  'Perú Libre': 2218,
  'Perú Primero': 2925,
  'Podemos Perú': 2731,
  Progresemos: 2967,
  'Pueblo Consciente': 3001,
  'Renovación Popular': 3040,
  'Salvemos al Perú': 2927,
  'Somos Perú': 3045,
  'Viva Puno': 2970,
};

export const simboloUrl = (partido: string) => {
  const id = ID_ORGANIZACION[partido];
  return id ? `/simbolos/${id}.jpg` : null;
};

interface Props {
  partido: string;
  className?: string;
}

export function Simbolo({ partido, className = 'h-12 w-12' }: Props) {
  const [falla, setFalla] = useState(false);
  const src = simboloUrl(partido);
  if (!src || falla) return null;
  return (
    <img
      src={src}
      alt={`Símbolo de ${partido}`}
      title={partido}
      loading="lazy"
      onError={() => setFalla(true)}
      className={`shrink-0 rounded-md border border-slate-200 bg-white object-contain p-0.5 ${className}`}
    />
  );
}
