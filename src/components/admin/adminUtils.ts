import type { ActivityEntry } from '../../data/api';

export function fmtRel(at: string | Date): string {
  const ms = typeof at === 'string' ? new Date(at).getTime() : at.getTime();
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return 'gerade eben';
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}

const COLS = { todo: 'Backlog', doing: 'In Arbeit', review: 'Review', done: 'Erledigt' } as const;

export interface ActivityView {
  icon: string;
  color: string;
  text: string;
}

export function activityLine(a: ActivityEntry, nameById: (id?: string | null) => string): ActivityView {
  const actor = nameById(a.actorId);
  const meta = (a.meta ?? {}) as Record<string, unknown>;
  const tgt = a.target ?? '';
  const tgtUser = a.target ? nameById(a.target) : null;
  switch (a.kind) {
    case 'invite_sent':
      return { icon: 'mail', color: '#5573A0', text: `${actor} hat ${tgt} eingeladen` };
    case 'invite_resent':
      return { icon: 'send', color: '#5573A0', text: `${actor} hat Einladung an ${tgt} erneut gesendet` };
    case 'invite_cancelled':
      return { icon: 'x-circle', color: '#A8A097', text: `${actor} hat Einladung an ${tgt} zurückgezogen` };
    case 'invite_accepted':
      return { icon: 'user-check', color: '#5E7F4E', text: `${tgt} hat Einladung angenommen` };
    case 'user_updated':
      return { icon: 'edit-3', color: '#A8A097', text: `${actor} hat Profil von ${tgtUser || tgt} aktualisiert` };
    case 'user_deactivated':
      return { icon: 'user-minus', color: '#B8442D', text: `${actor} hat ${tgtUser || tgt} deaktiviert` };
    case 'user_activated':
      return { icon: 'user-check', color: '#5E7F4E', text: `${actor} hat ${tgtUser || tgt} reaktiviert` };
    case 'role_changed':
      return {
        icon: 'shield',
        color: '#B88A2E',
        text: `${actor} hat Rolle von ${tgtUser || tgt} auf ${meta.to === 'admin' ? 'Admin' : 'Mitglied'} gesetzt`,
      };
    case 'team_created':
      return { icon: 'users', color: '#C85A2C', text: `${actor} hat Team „${meta.name ?? tgt}" angelegt` };
    case 'team_updated':
      return { icon: 'edit-3', color: '#C85A2C', text: `${actor} hat Team angepasst` };
    case 'team_deleted':
      return { icon: 'trash-2', color: '#B8442D', text: `${actor} hat Team gelöscht` };
    case 'project_created':
      return { icon: 'folder-plus', color: '#5573A0', text: `${actor} hat Projekt „${meta.code ?? tgt}" angelegt` };
    case 'project_updated':
      return { icon: 'edit-3', color: '#A8A097', text: `${actor} hat Projekt „${meta.code ?? tgt}" geändert` };
    case 'project_deleted':
      return { icon: 'trash-2', color: '#B8442D', text: `${actor} hat Projekt „${meta.code ?? tgt}" gelöscht` };
    case 'task_created':
      return { icon: 'plus-circle', color: '#5573A0', text: `${actor} hat Aufgabe „${meta.title ?? tgt}" angelegt` };
    case 'task_updated':
      return { icon: 'edit-3', color: '#A8A097', text: `${actor} hat „${meta.title ?? tgt}" bearbeitet` };
    case 'task_moved': {
      const from = (COLS as Record<string, string>)[(meta.from as string) ?? ''] ?? meta.from;
      const to = (COLS as Record<string, string>)[(meta.to as string) ?? ''] ?? meta.to;
      return {
        icon: 'arrow-right-circle',
        color: '#6B6359',
        text: `${actor} hat „${meta.title ?? tgt}" von ${from} nach ${to} verschoben`,
      };
    }
    case 'task_done':
      return { icon: 'check-circle', color: '#5E7F4E', text: `${actor} hat „${meta.title ?? tgt}" abgeschlossen` };
    case 'task_deleted':
      return { icon: 'trash-2', color: '#B8442D', text: `${actor} hat „${meta.title ?? tgt}" gelöscht` };
    case 'timer_started':
      return { icon: 'play', color: '#C85A2C', text: `${actor} hat Timer gestartet · „${meta.title ?? tgt}"` };
    case 'timer_stopped': {
      const h = typeof meta.hours === 'number' ? ` (${meta.hours.toFixed(2).replace('.', ',')}h gebucht)` : '';
      return {
        icon: 'square',
        color: '#6B6359',
        text: `${actor} hat Timer gestoppt · „${meta.title ?? tgt}"${h}`,
      };
    }
    default:
      return { icon: 'activity', color: '#A8A097', text: `${a.kind} · ${tgt}` };
  }
}

export const WORK_KINDS = new Set([
  'task_created',
  'task_updated',
  'task_moved',
  'task_done',
  'task_deleted',
  'project_created',
  'project_updated',
  'project_deleted',
  'timer_started',
  'timer_stopped',
]);

export const PALETTE = [
  '#4a6f8a', '#b86a3a', '#6a8455', '#8a5a8a', '#9a3838',
  '#5E7F4E', '#B88A2E', '#5573A0', '#C85A2C', '#6B6359',
];
