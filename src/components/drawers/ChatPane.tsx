import { useEffect, useRef, useState } from 'react';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import type { ChatMessage } from '../../lib/mockReply';
import { apiFetch } from '../../lib/api';

export interface ChatPaneProps {
  setText: (s: string) => void;
  setTab: (s: 'text' | 'file' | 'chat') => void;
  extract: () => void;
}

interface ChatBubbleProps {
  msg: ChatMessage;
  onSuggest: (s: string) => void;
  onUseAsBrief: (t: string) => void;
  onExtractNow: () => void;
}

// Trennt `<think>…</think>`-Blöcke vom sichtbaren Output. Manche Modelle
// (GLM, Qwen-R1 …) liefern interne Überlegungen mit; per Default einklappen.
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

function ChatBubble({ msg, onSuggest, onUseAsBrief, onExtractNow }: ChatBubbleProps) {
  const isUser = msg.role === 'user';
  const segments = isUser ? [{ kind: 'text' as const, content: msg.text }] : splitThink(msg.text);
  return (
    <div className={`chat-msg ${msg.role}`}>
      {!isUser && (
        <div className="chat-avatar">
          <Icon name="sparkles" size={11} />
        </div>
      )}
      <div className="chat-bubble-wrap">
        {segments.map((seg, k) =>
          seg.kind === 'think' ? (
            <details key={k} className="chat-think">
              <summary>
                <Icon name="brain" size={11} />
                <span>Gedanken</span>
              </summary>
              <div className="chat-think-body">
                {seg.content.split('\n').map((line, j) => (
                  <div key={j}>{line || ' '}</div>
                ))}
              </div>
            </details>
          ) : seg.content.trim() ? (
            <div key={k} className="chat-bubble">
              {seg.content.split('\n').map((line, j) => (
                <div key={j}>{line || ' '}</div>
              ))}
            </div>
          ) : null,
        )}
        {msg.brief && (
          <div className="chat-brief">
            <div className="chat-brief-head">
              <Icon name="file-text" size={11} />
              <span>{msg.brief.title}</span>
              <div style={{ flex: 1 }} />
              <button className="chat-brief-action" onClick={() => onUseAsBrief(msg.brief!.body)}>
                <Icon name="arrow-right" size={11} /> In Freitext laden
              </button>
              <button className="chat-brief-action accent" onClick={onExtractNow}>
                <Icon name="sparkles" size={11} /> Direkt extrahieren
              </button>
            </div>
            <pre className="chat-brief-body">{msg.brief.body}</pre>
          </div>
        )}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="chat-suggestions">
            {msg.suggestions.map((s, k) => (
              <button key={k} className="chat-suggest" onClick={() => onSuggest(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPane({ setText, setTab, extract }: ChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text:
        'Hi 👋 Ich helfe beim Planen. Schick mir eine PM-Anleitung, eine E-Mail oder beschreib einfach was ansteht — ich verteile auf Projekte, Personen und schätze Zeiten.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async (textOverride?: string) => {
    const userText = (textOverride ?? draft).trim();
    if (!userText) return;
    setDraft('');
    const newHistory: ChatMessage[] = [...messages, { role: 'user', text: userText }];
    setMessages(newHistory);
    setBusy(true);
    try {
      const res = await apiFetch<{ reply: { content: string } }>('/ai/chat', {
        method: 'POST',
        body: {
          messages: newHistory.map((m) => ({
            role: m.role,
            content: m.text,
          })),
        },
      });
      setMessages((m) => [...m, { role: 'assistant', text: res.reply.content }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'KI nicht erreichbar';
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️  ${msg}` }]);
      showToast('KI nicht erreichbar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-pane">
      <div className="chat-stream" ref={scrollRef}>
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            msg={msg}
            onSuggest={(s) => send(s)}
            onUseAsBrief={(t) => {
              setText(t);
              setTab('text');
              showToast('In Freitext-Tab übernommen');
            }}
            onExtractNow={() => {
              setTab('text');
              setTimeout(() => extract(), 250);
            }}
          />
        ))}
        {busy && (
          <div className="chat-msg assistant">
            <div className="chat-avatar">
              <Icon name="sparkles" size={11} />
            </div>
            <div className="chat-bubble thinking">
              <span className="dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Frag den Planungsassistenten…"
        />
        <button className="chat-send" onClick={() => send()} disabled={!draft.trim()}>
          <Icon name="arrow-up" size={14} />
        </button>
      </div>
    </div>
  );
}
