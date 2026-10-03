import type { DetalleCandidato, IndiceData, Planes } from '../types';

const APIDOCS = 'https://mpesije.jne.gob.pe/apidocs';

export const fotoUrl = (guid: string) => `${APIDOCS}/${guid}.jpg`;
export const pdfUrl = (ruta: string) => `${APIDOCS}/${ruta}`;

export function slugProvincia(provincia: string | null): string {
  if (!provincia) return 'region';
  return provincia
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

function memo<T>(cargar: () => Promise<T>) {
  let promesa: Promise<T> | null = null;
  return () => {
    promesa ??= cargar().catch((e) => {
      promesa = null;
      throw e;
    });
    return promesa;
  };
}

export const cargarIndice = memo(() => getJson<IndiceData>('/data/indice.json'));
export const cargarPlanes = memo(() => getJson<Planes>('/data/planes.json'));

const detallesPorProvincia = new Map<string, Promise<Record<string, DetalleCandidato>>>();

export async function cargarDetalle(provincia: string | null, id: string): Promise<DetalleCandidato | undefined> {
  const slug = slugProvincia(provincia);
  let promesa = detallesPorProvincia.get(slug);
  if (!promesa) {
    promesa = getJson<Record<string, DetalleCandidato>>(`/data/detalle-${slug}.json`).catch((e) => {
      detallesPorProvincia.delete(slug);
      throw e;
    });
    detallesPorProvincia.set(slug, promesa);
  }
  return (await promesa)[id];
}
