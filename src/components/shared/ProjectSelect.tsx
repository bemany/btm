// Wiederverwendbares Projekt-Select für alle Stellen wo man eine Aufgabe
// einem Projekt zuordnen will (TaskDetailDrawer, QuickAdd, QuickStart,
// AIDrawer). Default: nur Favoriten anzeigen, fremde Privatprojekte
// ausgeblendet. Wenn die Task in einem nicht-favorisierten Projekt liegt,
// bleibt dieses sichtbar (Force-Include via prop).
//
// Layout: <select> mit zwei <optgroup>s („Favoriten" + „Andere Projekte").
// Wenn keine Favoriten existieren, fallen wir auf alle nicht-fremd-privaten
// zurück (sonst hätte der User leere Liste).
//
// Esref hat einen Toggle „auch nicht-favorisierte zeigen" gewünscht
// (Feature FDpT3hc49EI). Das ist in einem kleinen Sub-Button neben dem
// Select rechts oben gelöst.

import { useState } from 'react';
import type { Project } from '../../store/types';
import { filterAssignableProjects } from '../../lib/projectFilters';
import { Icon } from './Icon';
import { useT } from '../../i18n';

export interface ProjectSelectProps {
  value: string | null;
  projects: Project[];
  currentUserId: string | null | undefined;
  onChange: (newProjectId: string | null) => void;
  /** Erlaubt leeren Wert (kein Projekt). Default: false. */
  allowNone?: boolean;
  className?: string;
  /** Inline-Styles für das <select>-Element. */
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Falls true: immer alle Projekte zeigen (überschreibt User-Toggle). */
  forceShowAll?: boolean;
}

export function ProjectSelect({
  value,
  projects,
  currentUserId,
  onChange,
  allowNone = false,
  className,
  style,
  disabled,
  forceShowAll = false,
}: ProjectSelectProps) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);

  // Sicherstellen dass der aktuelle Wert sichtbar bleibt (auch wenn nicht Favorit)
  const includeIds = value ? [value] : [];
  const { favorites, others, hiddenForeignPrivateCount } = filterAssignableProjects(projects, {
    currentUserId,
    showOnlyFavorites: !showAll && !forceShowAll,
    includeIds,
  });

  const userHasFavorites = projects.some(
    (p) => p.isFavorite && (!p.privateOwnerId || p.privateOwnerId === currentUserId),
  );
  const canToggleShowAll = userHasFavorites && others.length === 0 && !forceShowAll;
  const hasMoreProjects = userHasFavorites && (showAll || forceShowAll
    ? false
    : projects.some(
        (p) =>
          !p.isFavorite &&
          (!p.privateOwnerId || p.privateOwnerId === currentUserId) &&
          !includeIds.includes(p.id),
      ));

  return (
    <span className={`proj-select-wrap ${className ?? ''}`}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        style={style}
      >
        {allowNone && <option value="">{t('common.none')}</option>}
        {favorites.length > 0 && others.length > 0 ? (
          <>
            <optgroup label={`★ ${t('projects.favorites_short')}`}>
              {favorites.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('projects.others_short')}>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </optgroup>
          </>
        ) : (
          [...favorites, ...others].map((p) => (
            <option key={p.id} value={p.id}>
              {p.isFavorite ? `★ ${p.code}` : p.code}
            </option>
          ))
        )}
      </select>
      {hasMoreProjects && (
        <button
          type="button"
          className="proj-select-toggle"
          onClick={() => setShowAll(true)}
          title={t('projects.show_all_projects')}
        >
          <Icon name="plus" size={10} /> {t('projects.show_all_projects')}
        </button>
      )}
      {canToggleShowAll && false /* placeholder for future "shrink back to favorites" */}
      {hiddenForeignPrivateCount > 0 && false /* keine Info-UI für versteckte Privatprojekte — bewusst */}
    </span>
  );
}
