import { useState } from 'react';
import { fotoUrl } from '../data/store';

export function iniciales(nombre: string) {
  const partes = nombre.split(' ').filter(Boolean);
  return (partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '');
}

interface Props {
  nombre: string;
  foto: string | null;
  className?: string;
}

export function Foto({ nombre, foto, className = 'h-12 w-12' }: Props) {
  const [falla, setFalla] = useState(false);

  if (!foto || falla) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold uppercase text-white ${className}`}
      >
        {iniciales(nombre)}
      </div>
    );
  }
  return (
    <img
      src={fotoUrl(foto)}
      alt={`Foto de ${nombre}`}
      loading="lazy"
      onError={() => setFalla(true)}
      className={`shrink-0 rounded-full bg-slate-200 object-cover ${className}`}
    />
  );
}
