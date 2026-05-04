// AI-Backend-Proxy für LM-Studio (OpenAI-kompatibel).
// Token + URL nur server-seitig, niemals client-side.

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.js';
import { projects as projectsTable, users as usersTable } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const LMSTUDIO_URL = process.env.LMSTUDIO_URL ?? 'https://llm1.bemany.tech';
const LMSTUDIO_TOKEN = process.env.LMSTUDIO_TOKEN ?? '';
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL ?? 'zai-org/glm-4.6v-flash';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callLMStudio(opts: {
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<string> {
  if (!LMSTUDIO_TOKEN) throw new Error('LMSTUDIO_TOKEN nicht gesetzt');
  const body: Record<string, unknown> = {
    model: LMSTUDIO_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${LMSTUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LMSTUDIO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LM-Studio: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LM-Studio: keine Antwort');
  return content;
}

const extractSchema = z.object({
  text: z.string().min(1).max(50_000),
});

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(40),
});

export const aiRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // Aufgaben aus Text extrahieren
  .post('/extract', async (c) => {
    const me = c.get('user')!;
    const { text } = extractSchema.parse(await c.req.json());

    // Kontext mitliefern: Projekte + User-Liste, damit das Modell IDs zuordnen kann.
    const [projs, usrs] = await Promise.all([
      db.select({ id: projectsTable.id, code: projectsTable.code, name: projectsTable.name }).from(projectsTable),
      db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable),
    ]);

    const system = `Du bist BTM's Planungs-Assistent. Werkstattsprache, deutsch, sachlich.
Aus dem User-Text extrahierst du eine Liste konkreter Aufgaben.
Du antwortest IMMER und AUSSCHLIESSLICH mit JSON in dieser Form:

{"tasks":[
  {"title":"…","description":"…","project_id":"P…oder null","assignee_id":"…oder null","est_h":1.0,"prio":"low|med|high","notes":"…optional"},
  ...
]}

Regeln:
- Title kurz, imperativ. Keine Bullet-Points im Title.
- est_h realistisch (0.25–8). Wenn unklar: 1.
- prio nur "high" wenn explizit dringend/heute/blockierend.
- project_id und assignee_id NUR aus den unten gelisteten IDs auswählen,
  sonst null. Niemals erfinden.
- description als Markdown, optional. notes = Quellen-Hinweis ("aus Zeile 3").
- Wenn der Text keine Aufgaben enthält: {"tasks":[]}.

Verfügbare Projekte (id · code · name):
${projs.map((p) => `- ${p.id} · ${p.code} · ${p.name}`).join('\n') || '(keine)'}

Verfügbare Personen (id · name · email):
${usrs.map((u) => `- ${u.id} · ${u.name} · ${u.email}`).join('\n') || '(keine)'}
`;

    try {
      const raw = await callLMStudio({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        jsonMode: true,
        temperature: 0.2,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Fallback: erstes "{"…"}" aus dem Output rausziehen
        const m = /\{[\s\S]*\}/.exec(raw);
        parsed = m ? JSON.parse(m[0]) : { tasks: [] };
      }
      return c.json({ result: parsed, model: LMSTUDIO_MODEL, byUser: me.id });
    } catch (e) {
      console.error('[ai] extract failed', e);
      return c.json({ error: e instanceof Error ? e.message : 'extract failed' }, 502);
    }
  })

  // Chat-Endpoint für den AI-Drawer-Chat-Tab
  .post('/chat', async (c) => {
    const { messages } = chatSchema.parse(await c.req.json());

    const system = `Du bist BTM's Planungs-Assistent. Werkstattsprache, deutsch, sachlich, knapp.
Hilf dem User beim Planen seiner Woche: Aufgaben strukturieren, Zeit schätzen,
Pomodoro-Slots, Prioritäten. Wenn der User eine Aufgaben-Liste oder ein
Briefing schickt, frag ob du Tasks daraus extrahieren sollst (im UI gibt's
einen "Direkt extrahieren"-Knopf — du kannst ihn referenzieren).

Antworte als reiner Text. Keine Markdown-Tabellen außer der User fragt explizit.`;

    try {
      const reply = await callLMStudio({
        messages: [{ role: 'system', content: system }, ...messages],
        temperature: 0.5,
      });
      return c.json({ reply: { role: 'assistant', content: reply }, model: LMSTUDIO_MODEL });
    } catch (e) {
      console.error('[ai] chat failed', e);
      return c.json({ error: e instanceof Error ? e.message : 'chat failed' }, 502);
    }
  });
