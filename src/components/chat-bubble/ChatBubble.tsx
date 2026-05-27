// Floating Chat-Bubble unten rechts (Intercom-Style).
// Klein als Knopf, klickbar → größeres Panel mit Stream + Input.
// Spricht /api/ai/chat — der Backend-Endpoint kann Tools nutzen
// (Aufgaben anlegen, verschieben, Timer starten etc.).

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { apiFetch } from '../../lib/api';
import { SYNC_KEYS } from '../../data/sync';
import { useT } from '../../i18n';

interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: ToolCallTrace[];
}

interface ChatResponse {
  reply: { role: 'assistant'; content: string };
  toolCalls?: ToolCallTrace[];
  model?: string;
}

const STORAGE_KEY = 'btm.chatBubble.history';
const MAX_HISTORY = 40;

function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ChatMsg[];
    if (Array.isArray(arr)) return arr.slice(-MAX_HISTORY);
  } catch {
    /* ignore */
  }
  return [];
}

function saveHistory(msgs: ChatMsg[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

// Splittet `<think>…</think>`-Blöcke vom sichtbaren Output (Reasoning-Modelle).
type Segment = { kind: 'text' | 'think'; content: string };
function splitThink(raw: string): Segment[] {
  const segs: Segment[] = [];
  const re = /<think>([\s\S]*?)<\/think>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ kind: 'text', content: raw.slice(last, m.index) });
    segs.push({ kind: 'think', content: m[1].trim() });
    last = re.lastIndex;
  }
  const rest = raw.slice(last);
  const open = /<think>([\s\S]*)$/i.exec(rest);
  if (open) {
    if (open.index > 0) segs.push({ kind: 'text', content: rest.slice(0, open.index) });
    segs.push({ kind: 'think', content: open[1].trim() });
  } else if (rest.length) {
    segs.push({ kind: 'text', content: rest });
  }
  return segs.length ? segs : [{ kind: 'text', content: raw }];
}

// Welche Query-Keys nach welchem Tool-Call invalidiert werden.
const TOOL_INVALIDATIONS: Record<string, readonly string[][]> = {
  create_task: [SYNC_KEYS.TASKS as unknown as string[]],
  update_task: [SYNC_KEYS.TASKS as unknown as string[]],
  move_task: [SYNC_KEYS.TASKS as unknown as string[]],
  delete_task: [SYNC_KEYS.TASKS as unknown as string[]],
  create_project: [SYNC_KEYS.PROJECTS as unknown as string[]],
  start_timer: [SYNC_KEYS.TIMER as unknown as string[], SYNC_KEYS.TASKS as unknown as string[]],
  stop_timer: [SYNC_KEYS.TIMER as unknown as string[], SYNC_KEYS.TASKS as unknown as string[]],
};

// Tool-Labels werden zur Render-Zeit aus dem i18n-Context geholt (siehe
// `getToolLabel` unten). Der Key in chat_bubble.tool_<name> matcht 1:1.

const TOOL_ICON: Record<string, string> = {
  list_tasks: 'list',
  list_users: 'users',
  list_projects: 'folder',
  list_week: 'calendar-days',
  get_live_timer: 'timer',
  create_task: 'plus',
  update_task: 'pencil',
  move_task: 'arrow-right',
  delete_task: 'trash-2',
  create_project: 'folder-plus',
  start_timer: 'play',
  stop_timer: 'square',
  me: 'user',
};

interface ChatBubbleMsgProps {
  msg: ChatMsg;
}

function ChatBubbleMsg({ msg }: ChatBubbleMsgProps) {
  const t = useT();
  const isUser = msg.role === 'user';
  const segments = isUser ? [{ kind: 'text' as const, content: msg.text }] : splitThink(msg.text);
  const toolLabel = (name: string): string => {
    const known: Record<string, string> = {
      me: t('chat_bubble.tool_me'),
      list_tasks: t('chat_bubble.tool_list_tasks'),
      list_users: t('chat_bubble.tool_list_users'),
      list_projects: t('chat_bubble.tool_list_projects'),
      list_week: t('chat_bubble.tool_list_week'),
      get_live_timer: t('chat_bubble.tool_get_live_timer'),
      create_task: t('chat_bubble.tool_create_task'),
      update_task: t('chat_bubble.tool_update_task'),
      move_task: t('chat_bubble.tool_move_task'),
      delete_task: t('chat_bubble.tool_delete_task'),
      create_project: t('chat_bubble.tool_create_project'),
      start_timer: t('chat_bubble.tool_start_timer'),
      stop_timer: t('chat_bubble.tool_stop_timer'),
    };
    return known[name] ?? name;
  };
  return (
    <div className={`cb-msg ${msg.role}`}>
      {!isUser && (
        <div className="cb-avatar">
          <Icon name="sparkles" size={11} />
        </div>
      )}
      <div className="cb-bubble-wrap">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="cb-tools">
            {msg.toolCalls.map((tc, i) => (
              <div key={i} className={`cb-tool-card ${tc.ok ? 'ok' : 'err'}`}>
                <Icon name={TOOL_ICON[tc.name] ?? 'tool'} size={10} />
                <span className="cb-tool-name">{toolLabel(tc.name)}</span>
                {!tc.ok && <span className="cb-tool-err">{tc.error ?? t('chat_bubble.error_unavailable')}</span>}
              </div>
            ))}
          </div>
        )}
        {segments.map((seg, k) =>
          seg.kind === 'think' ? (
            <details key={k} className="cb-think">
              <summary>
                <Icon name="brain" size={10} />
                <span>{t('chat_bubble.thinking_label')}</span>
              </summary>
              <div className="cb-think-body">
                {seg.content.split('\n').map((line, j) => (
                  <div key={j}>{line || ' '}</div>
                ))}
              </div>
            </details>
          ) : seg.content.trim() ? (
            <div key={k} className="cb-bubble cb-bubble-md">
              {isUser ? (
                // User-Eingaben unveraendert anzeigen — kein Markdown-Parsing,
                // sonst werden eingegebene Sonderzeichen falsch interpretiert.
                seg.content.split('\n').map((line, j) => (
                  <div key={j}>{line || ' '}</div>
                ))
              ) : (
                // Assistant-Antworten als Markdown rendern (Listen, Code,
                // **bold**, *italic*, Tabellen via remark-gfm, Links).
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ children, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                  }}
                >
                  {seg.content}
                </ReactMarkdown>
              )}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function ChatBubble() {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(loadHistory);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, busy]);

  // Bubble nur einblenden wenn eingeloggt
  if (status !== 'authenticated' || !user) return null;

  const send = async (textOverride?: string) => {
    const userText = (textOverride ?? draft).trim();
    if (!userText || busy) return;
    setDraft('');
    const next: ChatMsg[] = [...messages, { role: 'user', text: userText }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await apiFetch<ChatResponse>('/ai/chat', {
        method: 'POST',
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.text })),
        },
      });
      const reply: ChatMsg = {
        role: 'assistant',
        text: res.reply.content,
        toolCalls: res.toolCalls,
      };
      setMessages((m) => [...m, reply]);

      // Nach erfolgreichen Schreib-Tools die passenden Queries invalidieren,
      // damit Board / Wochenansicht sofort den neuen Stand anzeigen.
      const touched = new Set<string>();
      for (const tc of res.toolCalls ?? []) {
        if (!tc.ok) continue;
        const keys = TOOL_INVALIDATIONS[tc.name];
        if (!keys) continue;
        for (const k of keys) touched.add(k.join('|'));
      }
      for (const sig of touched) {
        const key = sig.split('|');
        queryClient.invalidateQueries({ queryKey: key });
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : t('chat_bubble.error_unavailable');
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${errText}` }]);
      showToast(t('chat_bubble.error_unavailable'));
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMessages([]);
    saveHistory([]);
  };

  return (
    <>
      {!open && (
        <button
          className="cb-fab"
          onClick={() => setOpen(true)}
          aria-label={t('chat_bubble.title')}
          title={t('chat_bubble.title')}
        >
          <Icon name="sparkles" size={18} />
        </button>
      )}
      {open && (
        <div className="cb-panel" role="dialog" aria-label={t('chat_bubble.title')}>
          <div className="cb-header">
            <div className="cb-header-icon">
              <Icon name="sparkles" size={14} />
            </div>
            <div className="cb-header-text">
              <div className="cb-header-title">{t('chat_bubble.title')}</div>
              <div className="cb-header-sub">{t('chat_bubble.sub')}</div>
            </div>
            <button
              className="cb-icon-btn"
              onClick={clear}
              title={t('chat_bubble.clear_history')}
              aria-label={t('chat_bubble.clear_history')}
            >
              <Icon name="trash-2" size={13} />
            </button>
            <button
              className="cb-icon-btn"
              onClick={() => setOpen(false)}
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="cb-stream" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="cb-empty">
                <div className="cb-empty-icon">
                  <Icon name="sparkles" size={20} />
                </div>
                <div className="cb-empty-title">
                  {t('chat_bubble.welcome', { name: user.name?.split(' ')[0] ?? '' })}
                </div>
                <div className="cb-empty-body">{t('chat_bubble.welcome_sub')}</div>
                <div className="cb-empty-suggestions">
                  {[
                    t('chat_bubble.suggestion_open'),
                    t('chat_bubble.suggestion_create'),
                    t('chat_bubble.suggestion_move'),
                    t('chat_bubble.suggestion_timer'),
                  ].map((s) => (
                    <button key={s} className="cb-suggestion" onClick={() => void send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatBubbleMsg key={i} msg={m} />
            ))}
            {busy && (
              <div className="cb-msg assistant">
                <div className="cb-avatar">
                  <Icon name="sparkles" size={11} />
                </div>
                <div className="cb-bubble thinking">
                  <span className="cb-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="cb-input">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('chat_bubble.placeholder')}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="cb-send"
              onClick={() => void send()}
              disabled={!draft.trim() || busy}
              aria-label={t('common.next')}
            >
              <Icon name="arrow-up" size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
