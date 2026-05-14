// AI-Backend-Proxy. Wir sprechen das OpenAI-Chat-Completions-Protokoll —
// das schließt OpenAI selbst (Default) UND OpenAI-kompatible Endpunkte
// wie LM-Studio, vLLM, Anyscale oder selbstgehostete Modelle ein.
// Token + URL nur server-seitig, niemals client-side.
//
// Feature FkqjgMk6RH6: Umstellung von LM-Studio/Gemma auf OpenAI. Wir lesen
// jetzt primär die OPENAI_*-Umgebungsvariablen, bleiben aber rückwärts-
// kompatibel zu LMSTUDIO_* (Setup-Übergang ohne Downtime).

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.js';
import { projects as projectsTable, users as usersTable } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { TOOLS as MCP_TOOLS, handlers as toolHandlers, type ToolCtx } from './mcp.js';

// Provider-Config: OpenAI > LM-Studio-Legacy. Wenn OPENAI_API_KEY gesetzt
// ist, fahren wir gegen OpenAI. Sonst Fallback auf die alten LMSTUDIO_*-
// Variablen (für Roll-back ohne Code-Änderung).
//
// `||` statt `??` ist hier wichtig: docker-compose ersetzt nicht-gesetzte
// Variablen via `${VAR:-}` durch den leeren String `""` — der ist nicht
// null/undefined, würde `??` aber durchreichen und uns einen leeren URL/
// Token bescheren.
const AI_API_KEY = process.env.OPENAI_API_KEY || process.env.LMSTUDIO_TOKEN || '';
const AI_BASE_URL = (
  process.env.OPENAI_BASE_URL
  || (process.env.OPENAI_API_KEY ? 'https://api.openai.com' : process.env.LMSTUDIO_URL)
  || 'https://api.openai.com'
).replace(/\/+$/, '');
const AI_MODEL = process.env.OPENAI_MODEL
  || process.env.LMSTUDIO_MODEL
  || 'gpt-4o-mini';
const AI_PROVIDER_LABEL = process.env.OPENAI_API_KEY ? 'openai' : 'lmstudio';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Erkennt jeden „channel"-artigen Marker, robust gegen die Varianten, die
// Gemma 4 / gpt-oss / Qwen ausgeben:
//   <|channel|>thought, <channel>thought, <|channel|▷, <channel|▷,
//   <|channel|>final<|message|> usw. — auch mit Unicode-Triangle (U+25B7).
const CHANNEL_RE = /<\|?\s*channel\s*\|?[^>\n]{0,40}[>▷▷]/gi;
// Reine Marker-Tokens (Message, Start, End, Return …)
const MARKER_RE = /<\|?\s*(message|start|end|return|thought|commentary|final|analysis)\s*\|?\s*[>▷▷]?/gi;
// Übrigbleibende Tags <…> mit Pipes — als letzter Cleanup-Schritt
const RESIDUE_RE = /<\|?[^<>\n]{0,40}\|?>/g;

// Entfernt Reasoning-/Channel-Marker aus dem Modell-Output. Heuristik:
// Splitten beim LETZTEN gefundenen channel-Marker — alles davor ist
// Reasoning (raus), alles danach ist die finale Antwort. Sonst: rohen
// `<think>…</think>` und `<reasoning>…</reasoning>` raus, Rest behalten.
export function stripReasoning(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  const ms = [...s.matchAll(CHANNEL_RE)];
  if (ms.length > 0) {
    const last = ms[ms.length - 1];
    s = s.slice(last.index! + last[0].length);
  }
  s = s.replace(MARKER_RE, '').replace(RESIDUE_RE, '');
  return s;
}

// Wandelt Reasoning-Anteile in <think>…</think> um, damit die ChatPane-
// Frontend-Logik sie konsistent einklappen kann. Vier Varianten:
//   1) Modell liefert schon `<think>…</think>` → unangetastet lassen.
//   2) Harmony-Channels: split am LETZTEN channel-Marker. Alles davor =
//      Reasoning, Alles danach = finale Antwort.
//   3) „nackte" Reasoning-Prosa — Output beginnt mit `thought\n…` oder einem
//      typischen Englisch-Plan-Marker (`The user`, `Plan:`, `I should`,
//      `I have already`). Heuristisch wrappen.
//   4) Reines Englisch-Reasoning + leere Channel-Marker → wir wrappen.

// Erkennungs-Pattern für markerlose Reasoning-Prosa, die Gemma 4 manchmal
// statt einer sauberen `<|channel|>thought`-Notation ausgibt.
const NAKED_THOUGHT_RE =
  /^[\s\n]*(?:thought\b|analysis\b|commentary\b|The user (?:asks|wants|is|has|said)|I (?:have already|should|will|need|am|can)|Plan:|Here's a thinking process|Let me think|I'll )/i;

// Trennt nackten Reasoning-Block vom Final-Antwort-Block. Sucht nach einer
// erkennbaren „Antwort-Boundary" (typische deutsche/markdown-Patterns die
// Gemma 4 als Final-Output nutzt).
function splitNakedReasoning(s: string): { thought: string; final: string } | null {
  // Such-Patterns für den Anfang der finalen Antwort (höchste Priorität zuerst)
  const boundaries: RegExp[] = [
    /\n\s*\*\*Zusammenfassung:?\*\*/m,
    /\n\s*##?#? /m, // Markdown-Heading
    /\n\s*Du hast /m,
    /\n\s*Hier (?:ist|sind|kommt) /m,
    /\n\s*Im Team /m,
    /\n\s*Die Aufgabe /m,
    /\n\s*Folgende /m,
    /\n\s*\*\s+\*\*/m, // Aufzählung mit Bold-Item
    /\n\s*[-•]\s+\*\*/m,
    /\n\s*Es gibt /m,
  ];
  for (const re of boundaries) {
    const m = re.exec(s);
    if (m && m.index !== undefined) {
      const thought = s.slice(0, m.index).trim();
      const final = s.slice(m.index).trim();
      if (thought.length > 30 && final.length > 0) return { thought, final };
    }
  }
  return null;
}

export function harmonyToThinkTags(raw: string): string {
  // Wenn schon <think>...</think> drin → durchreichen, splitThink im FE faltet.
  if (/<think>[\s\S]*?<\/think>/i.test(raw)) return raw.trim();

  const ms = [...raw.matchAll(CHANNEL_RE)];
  if (ms.length === 0) {
    // Keine Channel-Marker. Heuristik: erkennen ob nackte Reasoning-Prosa.
    const cleaned = raw.replace(MARKER_RE, '').replace(RESIDUE_RE, '').trim();
    if (NAKED_THOUGHT_RE.test(cleaned)) {
      const split = splitNakedReasoning(cleaned);
      if (split) {
        return `<think>\n${split.thought}\n</think>\n${split.final}`;
      }
      // Reasoning erkannt, aber keine klare Antwort-Boundary → alles wrappen
      // damit der User wenigstens sieht dass die KI was getan hat.
      return `<think>\n${cleaned}\n</think>\nIch habe deine Anfrage verarbeitet — Details siehe Tool-Calls oben.`;
    }
    // Kein Reasoning-Pattern → durchreichen
    return cleaned;
  }

  const last = ms[ms.length - 1];
  const before = raw.slice(0, last.index!);
  const after = raw.slice(last.index! + last[0].length);
  const cleanBefore = before.replace(CHANNEL_RE, '').replace(MARKER_RE, '').replace(RESIDUE_RE, '').trim();
  const cleanAfter = after.replace(CHANNEL_RE, '').replace(MARKER_RE, '').replace(RESIDUE_RE, '').trim();
  if (!cleanBefore) return cleanAfter;
  if (!cleanAfter) {
    return `<think>\n${cleanBefore}\n</think>\nIch habe die Anfrage verarbeitet — Details siehe Tool-Calls oben.`;
  }
  return `<think>\n${cleanBefore}\n</think>\n${cleanAfter}`;
}

async function callLMStudio(opts: {
  messages: ChatMessage[];
  jsonSchema?: object;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  signal?: AbortSignal;
}): Promise<string> {
  if (!AI_API_KEY) throw new Error('OPENAI_API_KEY (oder Legacy LMSTUDIO_TOKEN) nicht gesetzt');
  const body: Record<string, unknown> = {
    model: AI_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
    top_p: opts.topP ?? 0.9,
    // Gemma 4 unterstützt einen optionalen reasoning-Modus. Für JSON-Extract
    // wollen wir keinen `<think>`-Block — Antwortet das Modell trotzdem
    // mit `<think>…</think>`, strippen wir es vor dem Parse weg.
  };
  // LM-Studio akzeptiert nur 'json_schema' oder 'text' (nicht 'json_object').
  // Bei jsonSchema schicken wir es als strict structured output mit, sonst
  // verlassen wir uns auf den System-Prompt + defensives Parsing.
  if (opts.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'btm_response', strict: true, schema: opts.jsonSchema },
    };
  }

  const res = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI (${AI_PROVIDER_LABEL}): HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`AI (${AI_PROVIDER_LABEL}): keine Antwort`);
  return content;
}

// ── Tool-Calling-Variante (für den Chat) ────────────────────────────────
//
// Wandelt unsere MCP-TOOL-Definitionen ins OpenAI-Function-Calling-Format
// um, das LM-Studio (für Modelle mit Tool-Support) versteht.

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

// Subset der MCP-Tools, die im Chat sinnvoll sind. delete_task lassen wir raus
// — destruktive Aktionen via Chat sind zu riskant, lieber explizit im UI.
const CHAT_TOOL_NAMES = new Set([
  'me',
  'list_tasks',
  'create_task',
  'update_task',
  'move_task',
  'list_projects',
  'create_project',
  'list_users',
  'start_timer',
  'stop_timer',
  'get_live_timer',
  'list_week',
]);

const CHAT_TOOLS: OpenAITool[] = (MCP_TOOLS as readonly { name: string; description: string; inputSchema: object }[])
  .filter((t) => CHAT_TOOL_NAMES.has(t.name))
  .map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));

interface LMSToolCall {
  id?: string;
  type?: 'function';
  function: { name: string; arguments: string };
}
interface LMSAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: LMSToolCall[];
}
type LMSMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | LMSAssistantMessage
  | { role: 'tool'; content: string; tool_call_id: string; name?: string };

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  result?: unknown;
  error?: string;
}

// Führt einen Chat-Turn mit Tool-Calling-Loop durch (max 5 Tool-Iterationen).
// Liefert finale Assistant-Nachricht (ohne Reasoning-Marker) plus die Liste
// der durchgeführten Tool-Calls — die UI kann sie als Mini-Cards anzeigen.
async function chatWithTools(opts: {
  messages: LMSMessage[];
  ctx: ToolCtx;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; toolCalls: ToolCallTrace[] }> {
  if (!AI_API_KEY) throw new Error('OPENAI_API_KEY (oder Legacy LMSTUDIO_TOKEN) nicht gesetzt');
  const conversation: LMSMessage[] = [...opts.messages];
  const trace: ToolCallTrace[] = [];
  // Dedup-Schutz: wenn das Modell denselben Tool-Aufruf wiederholt (kommt
  // bei nicht-tool-use-trainierten Modellen wie Gemma 4 vor), brechen wir ab
  // und liefern das letzte Result als finale Zusammenfassung.
  const seenSignatures = new Set<string>();

  for (let iter = 0; iter < 5; iter++) {
    const body: Record<string, unknown> = {
      model: AI_MODEL,
      messages: conversation,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      top_p: 0.9,
      tools: CHAT_TOOLS,
      tool_choice: 'auto',
    };
    const res = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`AI (${AI_PROVIDER_LABEL}): HTTP ${res.status} ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: LMSAssistantMessage;
        finish_reason?: string;
      }>;
    };
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error(`AI (${AI_PROVIDER_LABEL}): leere Antwort`);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      // Kein Tool-Call → finale Antwort
      return { content: msg.content ?? '', toolCalls: trace };
    }

    // Dedup: wenn dieser Aufruf-Satz exakt schon mal so kam, abbrechen
    const sig = calls
      .map((c) => `${c.function?.name}:${c.function?.arguments ?? ''}`)
      .sort()
      .join('||');
    if (seenSignatures.has(sig)) {
      const last = trace[trace.length - 1];
      const summary = last && last.ok
        ? `Hier ist was ich gefunden habe:\n\n\`\`\`json\n${JSON.stringify(last.result, null, 2).slice(0, 1200)}\n\`\`\``
        : 'Konnte die Aktion nicht abschließen.';
      return { content: summary, toolCalls: trace };
    }
    seenSignatures.add(sig);

    // Assistant-Message mit tool_calls in den Verlauf eintragen
    conversation.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: calls,
    });

    // Alle Tool-Calls dieser Runde sequentiell ausführen
    for (const call of calls) {
      const name = call.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch (e) {
        args = {};
        trace.push({ name, args: {}, ok: false, error: 'Argument-JSON nicht parse-bar' });
        conversation.push({
          role: 'tool',
          content: JSON.stringify({ error: 'arguments must be valid JSON' }),
          tool_call_id: call.id ?? '',
          name,
        });
        continue;
      }
      const handler = toolHandlers[name];
      if (!handler) {
        trace.push({ name, args, ok: false, error: 'Tool unbekannt' });
        conversation.push({
          role: 'tool',
          content: JSON.stringify({ error: `unknown tool: ${name}` }),
          tool_call_id: call.id ?? '',
          name,
        });
        continue;
      }
      try {
        const result = await handler(args, opts.ctx);
        trace.push({ name, args, ok: true, result });
        conversation.push({
          role: 'tool',
          content: JSON.stringify(result).slice(0, 8000),
          tool_call_id: call.id ?? '',
          name,
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        trace.push({ name, args, ok: false, error });
        conversation.push({
          role: 'tool',
          content: JSON.stringify({ error }),
          tool_call_id: call.id ?? '',
          name,
        });
      }
    }
  }

  // Iteration-Limit erreicht — model rief zu viele Tools auf
  return {
    content:
      'Ich habe die Aufgaben durchgeführt — wegen Iterations-Limits hier eine kurze Zusammenfassung in der Sidebar.',
    toolCalls: trace,
  };
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
        temperature: 0.2,
        maxTokens: 2500,
        topP: 0.85,
        // Strict JSON-Schema → das Modell muss direkt das passende Objekt
        // ausgeben und kann nicht in Thought-Channels abdriften (Gemma/gpt-oss
        // nutzen sonst Harmony-Markup das wir mühsam strippen müssten).
        jsonSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  project_id: { type: ['string', 'null'] },
                  assignee_id: { type: ['string', 'null'] },
                  est_h: { type: 'number' },
                  prio: { type: 'string', enum: ['low', 'med', 'high'] },
                  notes: { type: ['string', 'null'] },
                },
                required: [
                  'title',
                  'description',
                  'project_id',
                  'assignee_id',
                  'est_h',
                  'prio',
                  'notes',
                ],
                additionalProperties: false,
              },
            },
          },
          required: ['tasks'],
          additionalProperties: false,
        },
      });
      // Reasoning-/Harmony-Output strippen vor dem JSON-Parse:
      //   • <think>…</think>          (GLM, Qwen-R1, Deepseek-R1)
      //   • <|channel|>thought…       (gpt-oss-Harmony bis zum nächsten Channel-Tag)
      //   • <|channel|>commentary…    (gleiches Pattern)
      //   • <|message|>, <|start|>, <|end|>, <|return|> Marker komplett raus
      const stripped = stripReasoning(raw).trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripped);
      } catch {
        // Fallback: erste {...} aus dem Output rauspopeln (greedy match auf
        // ausbalanciertes JSON-Objekt).
        const m = /\{[\s\S]*\}/.exec(stripped);
        try {
          parsed = m ? JSON.parse(m[0]) : { tasks: [] };
        } catch (parseErr) {
          console.warn(
            '[ai] extract JSON-parse failed. raw[0..400]:',
            raw.slice(0, 400),
            'stripped[0..400]:',
            stripped.slice(0, 400),
            'parseErr:',
            parseErr,
          );
          parsed = { tasks: [] };
        }
      }
      return c.json({ result: parsed, model: AI_MODEL, byUser: me.id });
    } catch (e) {
      console.error('[ai] extract failed', e);
      return c.json({ error: e instanceof Error ? e.message : 'extract failed' }, 502);
    }
  })

  // Chat-Endpoint mit Tool-Calling — der Assistent kann Aufgaben anlegen,
  // verschieben, Timer starten/stoppen etc. (gleiche Tools wie MCP, ohne
  // delete_task — destruktive Aktionen bleiben dem UI vorbehalten).
  .post('/chat', async (c) => {
    const me = c.get('user')!;
    const { messages } = chatSchema.parse(await c.req.json());

    const system = `Du bist BTM's Planungs-Assistent. Werkstattsprache, deutsch, sachlich, knapp.
Hilf dem User beim Planen seiner Woche: Aufgaben anlegen, verschieben, Zeit schätzen,
Pomodoro-Slots starten, Prioritäten setzen.

Du hast Tools — nutze sie wenn der User dich um eine Aktion bittet:
- list_tasks / list_week / list_users / list_projects → zum Lesen
- create_task / update_task / move_task → zum Schreiben
- start_timer / stop_timer / get_live_timer → für Zeiterfassung

Wichtige Regeln für Tool-Use:
- assignee_id und project_id NUR aus list_users/list_projects-Ergebnissen.
- Wenn unsicher → erst auflisten, dann Aktion.
- Bei Mehrfach-Aktionen: nicht alles auf einmal, sondern Schritt für Schritt.
- Nach getaner Aktion: kurz auf Deutsch zusammenfassen was erledigt wurde.
- Wenn der User nur fragt / planen will (keine Aktion): einfach text antworten.

Antworte als reiner Text. Keine Markdown-Tabellen außer der User fragt explizit.`;

    try {
      const result = await chatWithTools({
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content }) as LMSMessage),
        ],
        ctx: { userId: me.id, userRole: me.role as 'admin' | 'member' },
        temperature: 0.4,
        maxTokens: 1500,
      });
      // Harmony-thought-Channels in <think>…</think> umbiegen, damit das
      // Frontend sie konsistent eingeklappt rendern kann.
      const normalized = harmonyToThinkTags(result.content);
      return c.json({
        reply: { role: 'assistant', content: normalized },
        toolCalls: result.toolCalls,
        model: AI_MODEL,
      });
    } catch (e) {
      console.error('[ai] chat failed', e);
      return c.json({ error: e instanceof Error ? e.message : 'chat failed' }, 502);
    }
  });
