# Voto Informado Puno

Plataforma para conocer y comparar a **todos** los candidatos de la región Puno en las
Elecciones Regionales y Municipales 2026 (gobernador, vicegobernador, consejeros
regionales, alcaldes y regidores provinciales y distritales): unos 3,900 registros,
con su hoja de vida y el resumen de su plan de gobierno.

Sin backend propio ni base de datos: los datos son archivos JSON estáticos en
`public/data/`, generados a partir de la API pública del JNE
(https://votoinformado.jne.gob.pe). Todo dato personal es lo que el propio candidato
declaró ante el JNE — la app no lo verifica y lo dice en cada ficha.

## Qué incluye

- Filtros por provincia → distrito, cargo, organización política y nombre. Al elegir un
  lugar también se muestran los cargos que lo abarcan (regionales y provinciales).
  Por defecto solo candidaturas vigentes (`Inscrito`); un interruptor incluye las
  excluidas, renunciadas, improcedentes y tachadas.
- Ficha de cada candidato: foto, edad y lugar de nacimiento, experiencia laboral, formación
  académica, trayectoria política y renuncias, sentencias declaradas, ingresos y patrimonio
  declarados, y el plan de gobierno de su lista (con enlaces a los PDF originales).
- Comparador de 2-3 candidatos lado a lado por dimensión del plan de gobierno.
- Veredicto de IA comparando las propuestas de 2 candidatos en un tema — vía una función
  serverless en `api/comparar.ts`, para no exponer la clave de la API en el navegador.
  Usa **Groq** (https://console.groq.com) como modelo, que tiene un nivel gratuito
  generoso (no pide tarjeta) — ideal para probar sin costo antes de decidir si conviene
  pasar a un modelo de pago.

## Conseguir la clave gratuita de Groq

1. Entra a https://console.groq.com y crea una cuenta (gratis, sin tarjeta).
2. Ve a "API Keys" y genera una clave.
3. Pégala en `.env.local` como `GROQ_API_KEY=...` (ver más abajo).

Límites del nivel gratuito y modelos disponibles: https://console.groq.com/docs/models —
si `llama-3.3-70b-versatile` (el modelo usado en `api/comparar.ts`) queda deprecado,
cambia el valor de `GROQ_MODEL` por el que indique esa página.

## Instalación local

```bash
npm install
cp .env.example .env.local
# Editar .env.local y poner tu GROQ_API_KEY
```

Para probar el frontend solo (sin el veredicto de IA):

```bash
npm run dev
```

Para probar todo, incluyendo la función `api/comparar.ts`, usa Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

`vercel dev` pedirá iniciar sesión con tu cuenta de Vercel la primera vez (abre el
navegador) — esa parte solo la puedes hacer tú, no se puede automatizar desde acá.

## Deploy

1. Sube este proyecto a un repositorio de GitHub.
2. Impórtalo en [vercel.com](https://vercel.com) (detecta Vite automáticamente).
3. En "Environment Variables" agrega `GROQ_API_KEY`.
4. Deploy.

## Actualizar los datos desde el JNE

La situación de las candidaturas cambia hasta el día de la elección (exclusiones,
renuncias…), así que conviene volver a descargar antes de publicar. Los scripts hacen
una petición a la vez, con pausas, para no cargar el servidor del JNE, y son
reanudables. En orden:

```bash
npm run datos:listas       # listas y candidatos de las 13 provincias (≈10 min)
npm run datos:hojas-vida   # hoja de vida de cada candidato (≈1 h; se puede relanzar)
npm run datos:planes       # resumen del plan de gobierno de cada lista (≈5 min)
npm run datos:build        # genera public/data/ (lo que consume la app)
```

Lo descargado en bruto queda en `data/` (no se sirve); la app solo usa `public/data/`.

Los endpoints usados son los mismos que llama el sitio público del JNE (no hay CAPTCHA
en ellos): `/api/v1/departamentos/.../distritos`, `POST /api/v1/candidatos/organizaciones`
y `.../organizaciones/candidatos` (el cuerpo lleva `dep`, `pro`, `dis` — con otros nombres
el servidor no da error, ignora los campos y devuelve datos incompletos),
`GET /api/v1/candidatos/hoja-vida/{id}` y `GET /api/v1/plan-gobierno/resumen`.

## Qué falta para producción

- Volver a correr la descarga de datos poco antes de publicar (ver arriba).
- Revisar el prompt de `api/comparar.ts` si se quiere ajustar el tono del veredicto.
- `public/data/planes.json` pesa ~4 MB: si hace falta, partirlo por tipo de elección.
