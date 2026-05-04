export interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  brief?: { title: string; body: string };
  suggestions?: string[];
}

export function mockReply(input: string): ChatMessage {
  const t = input.toLowerCase();

  if (t.includes('etappe 2') || t.includes('legal') || t.includes('impressum')) {
    return {
      role: 'assistant',
      text:
        'Etappe 2 — Legal & Impressum. Hier ein Brief, den ich aus den letzten Mails + dem Anwaltsfeedback gebaut habe. 5 Aufgaben, fokussiert auf rechtliche Pflichten:',
      brief: {
        title: 'fahrerapp-etappe-2-legal.md',
        body:
          '# FahrerApp — Etappe 2: Legal & Impressum\n\n| # | Aufgabe                                  | Wer    | Zeit  |\n|---|------------------------------------------|--------|-------|\n| 1 | Impressum-Seite (web + app)              | Arne   | 1 h   |\n| 2 | Datenschutzerklärung Update              | PM     | 2 h   |\n| 3 | Cookie-Consent-Banner einbauen           | Arne   | 1,5 h |\n| 4 | AVV-Checkliste mit Anwalt durchgehen     | PM     | 1 h   |\n| 5 | DSGVO-Hinweise in App-Onboarding         | Hakan  | 1 h   |\n',
      },
    };
  }
  if (t.includes('arne') && (t.includes('woche') || t.includes('offen'))) {
    return {
      role: 'assistant',
      text:
        'Arne (du) hat KW 19 5,0h geplant + 6 offene Aufgaben. Eine läuft gerade (Live-Timer). Top-Liste:\n\n• index.html Meta-Tags · 0,5h · gerade aktiv\n• robots.txt + sitemap.xml · 0,5h\n• Web-Push: VAPID-Keys generieren · 1,5h (Review)\n• Lighthouse-Audit Top-3 Findings · 1,5h\n• og:image korrigieren · 1,0h\n\nGesamt-Schätzung: ~5,0h von 40h Wochenkapazität (13%).',
      suggestions: ['Plane mir Pomodoro-Slots für Mittwoch', 'Welche Aufgaben blockieren andere?'],
    };
  }
  if (t.includes('push') || t.includes('vapid')) {
    return {
      role: 'assistant',
      text:
        'Klar — Web-Push-Setup. Ich brauch ein paar Infos, dann packen wir das in einen Brief:\n\n1. Soll der Service-Worker schon existieren oder neu?\n2. Backend in Node oder Python?\n3. Notifications nur Browser oder auch native iOS/Android?',
      suggestions: ['SW neu, Node-Backend, nur Browser', 'Beides nativ, iOS via APNs'],
    };
  }
  if (t.includes('pomodoro') || t.includes('mittwoch') || t.includes('slot')) {
    return {
      role: 'assistant',
      text:
        'Vorschlag für Mittwoch (8h-Tag, 4× Pomodoro à 25min Fokus + 5min Pause):\n\n09:00 – 09:25  Meta-Tags + og:image  (P1)\n09:30 – 09:55  robots.txt + sitemap   (P1)\n10:10 – 10:35  Lighthouse Audit       (P1)\n10:40 – 11:05  Top-Findings fixen     (P1)\n\nDanach 1h Mittag, ab 13:00 weiter mit Web-Push (VAPID-Keys + SW-Setup, ca. 1,5h).',
      suggestions: ['Eintragen in Wochenboard', 'Andere Reihenfolge bitte'],
    };
  }
  if (t.includes('eintragen') || t.includes('extrahieren') || t.includes('anlegen')) {
    return {
      role: 'assistant',
      text:
        'OK. Ich schalte rüber zum Freitext-Tab und extrahiere die Tabelle direkt — dann kannst du noch markieren, was angelegt wird.',
      brief: {
        title: 'aus Chat übernommen',
        body:
          '# Aus Chat\n\n| # | Aufgabe | Wer | Zeit |\n|---|---------|-----|------|\n| 1 | Meta-Tags + og:image | Arne | 1 h |\n| 2 | robots.txt + sitemap | Arne | 0,5 h |\n| 3 | Lighthouse Audit | Arne | 0,5 h |\n| 4 | Top-Findings fixen | Arne | 0,5 h |\n| 5 | VAPID-Keys + SW-Setup | Arne | 1,5 h |\n',
      },
    };
  }
  return {
    role: 'assistant',
    text:
      'Verstanden. Magst du das in eine kurze Anleitung packen (1 Aufgabe pro Zeile, Wer + Zeit) oder direkt das Original-Dokument einkippen? Dann extrahiere ich daraus Tasks.',
    suggestions: ['Original einkippen (Freitext-Tab)', 'Beispiel Etappe 2 zeigen'],
  };
}
