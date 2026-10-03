import type { VercelRequest, VercelResponse } from '@vercel/node';

// Modelo gratuito vía Groq (https://console.groq.com) — sin costo, con límite
// de uso generoso. Si Groq retira este modelo, revisa el listado vigente en
// https://console.groq.com/docs/models y actualiza GROQ_MODEL.
const GROQ_MODEL = 'openai/gpt-oss-120b';

interface CandidatoInput {
  nombre: string;
  partido: string;
  propuestas: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Falta configurar GROQ_API_KEY en el servidor (ver .env.example).',
    });
    return;
  }

  const { tema, candidatoA, candidatoB } = req.body as {
    tema?: string;
    candidatoA?: CandidatoInput;
    candidatoB?: CandidatoInput;
  };

  if (!candidatoA || !candidatoB) {
    res.status(400).json({ error: 'Faltan los dos candidatos a comparar' });
    return;
  }

  const temaTexto = tema && tema !== 'general' ? tema : 'sus propuestas en general';

  const prompt = `Eres un analista electoral imparcial para una plataforma de voto informado en Puno, Perú.
Compara a dos candidatos sobre ${temaTexto}.

Candidato A: ${candidatoA.nombre} (${candidatoA.partido})
Propuestas: ${candidatoA.propuestas.length ? candidatoA.propuestas.join(' | ') : 'No registra propuestas en este tema.'}

Candidato B: ${candidatoB.nombre} (${candidatoB.partido})
Propuestas: ${candidatoB.propuestas.length ? candidatoB.propuestas.join(' | ') : 'No registra propuestas en este tema.'}

Da un veredicto breve (máximo 120 palabras) sobre cuál propuesta es más sólida, evaluando claridad,
viabilidad y si incluye financiamiento o plazos concretos. Si uno de los dos no tiene propuestas
registradas, dilo explícitamente en vez de inventar contenido. No asumas datos que no te di.
Termina siempre con una línea aparte: "Veredicto: [nombre del candidato o Empate]".`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        reasoning_effort: 'low',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      console.error('Error de Groq:', groqResponse.status, errorBody);
      res.status(502).json({ error: 'El modelo gratuito no respondió correctamente. Intenta de nuevo.' });
      return;
    }

    const data = (await groqResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    // La página muestra texto plano: quitar el markdown (**negritas**, # títulos) que agrega el modelo.
    const analisis = (data.choices?.[0]?.message?.content ?? '').replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '').trim();

    res.status(200).json({ analisis });
  } catch (err) {
    console.error('Error llamando a Groq:', err);
    res.status(500).json({ error: 'No se pudo generar el análisis. Intenta de nuevo en unos segundos.' });
  }
}
