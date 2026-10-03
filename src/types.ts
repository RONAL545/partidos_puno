export interface CandidatoIndice {
  id: string;
  nombre: string;
  partido: string;
  cargo: string;
  provincia: string | null;
  distrito: string | null;
  estado: string;
  num: number | null;
  lista: string | null;
  foto: string | null;
  hv: boolean;
}

export interface IndiceData {
  generadoEl: string;
  fuente: string;
  provincias: Record<string, string[]>;
  cargos: string[];
  partidos: string[];
  estados: string[];
  dimensiones: string[];
  candidatos: CandidatoIndice[];
}

export interface Experiencia {
  centro: string | null;
  cargo: string | null;
  desde: string | null;
  hasta: string | null;
  lugar: string | null;
}

export interface Estudio {
  nivel: string;
  institucion?: string | null;
  carrera?: string | null;
  estado?: string;
  anio?: string | null;
  detalle?: string | null;
}

export interface CargoPolitico {
  tipo: string;
  cargo: string | null;
  organizacion: string | null;
  desde: string | null;
  hasta: string | null;
}

export interface SentenciaPenal {
  fuero?: string;
  expediente?: string;
  fecha: string | null;
  fallo?: string;
  materia?: string;
  cumplimiento?: string;
  comentario: string | null;
}

export interface SentenciaObligacion {
  fuero?: string;
  expediente?: string;
  fallo?: string;
  materia?: string;
  comentario: string | null;
}

export interface Monto {
  n: number;
  valor: number;
}

export interface DetalleCandidato {
  pdf: string | null;
  nac?: { fecha: string; lugar: string | null };
  sexo?: string;
  inscrito?: string;
  exp?: Experiencia[];
  edu?: Estudio[];
  pol?: CargoPolitico[];
  ren?: { organizacion: string | null; anio: string | null }[];
  sen?: { penales: SentenciaPenal[]; obligaciones: SentenciaObligacion[] };
  pat?: {
    ingreso?: { anio: string; total: number };
    inmuebles?: Monto;
    muebles?: Monto;
    acciones?: Monto;
  };
  adicional?: string[];
}

export interface ItemPlan {
  problema: string | null;
  objetivo: string | null;
  meta: string | null;
  indicador: string | null;
}

export interface DimensionPlan {
  nombre: string;
  items: ItemPlan[];
}

export interface PlanGobierno {
  partido: string;
  tipo: string | null;
  pdfCompleto: string | null;
  pdfResumen: string | null;
  vision: string | null;
  ideario: string | null;
  dimensiones: DimensionPlan[];
}

export type Planes = Record<string, PlanGobierno>;

export interface Filtros {
  provincia: string;
  distrito: string;
  cargo: string;
  partido: string;
  busqueda: string;
  incluirNoVigentes: boolean;
}
