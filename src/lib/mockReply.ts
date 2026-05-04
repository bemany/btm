// Type-Export für ChatPane.
// (mockReply()-Funktion entfernt — AI-Drawer läuft jetzt komplett gegen
// /api/ai/chat → LM-Studio.)

export interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  brief?: { title: string; body: string };
  suggestions?: string[];
}
