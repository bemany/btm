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

function ChatBubble({ msg, onSuggest, onUseAsBrief, onExtractNow }: ChatBubbleProps) {
  const isUser = msg.role === 'user';
  return (
    <div className={`chat-msg ${msg.role}`}>
      {!isUser && (
        <div className="chat-avatar">
          <Icon name="sparkles" size={11} />
        </div>
      )}
      <div className="chat-bubble-wrap">
        <div className="chat-bubble">
          {msg.text.split('\n').map((line, j) => (
            <div key={j}>{line || ' '}</div>
          ))}
        </div>
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
