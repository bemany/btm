// BTM Mobile-App — Top-Level Shell für die PWA.
// Aktiviert wenn useIsMobile() === true (Viewport < 768px oder ?mobile=1).
//
// 8 Screens nach Design (claude.ai/design Handoff):
//   home    → Heute
//   board   → Wochenboard
//   ki      → Foto/Text → KI
//   me      → Profil
//   create  → Neue Aufgabe (Sheet, vom FAB)
//   detail  → Task-Detail (Sheet, vom Tap auf Card)
//   timer   → Fokus-Timer (Pomodoro, vom Live-Card-Tap)
//   lock    → Lockscreen-Notification-Preview (Profil → Push testen)

import { useState, useCallback } from 'react';
import { MobScreenHeute } from './MobScreenHeute';
import { MobScreenCreate } from './MobScreenCreate';
import { MobScreenDetail } from './MobScreenDetail';
import { MobScreenTimer } from './MobScreenTimer';
import { MobScreenCapture } from './MobScreenCapture';
import { MobScreenBoard } from './MobScreenBoard';
import { MobScreenProfile } from './MobScreenProfile';
import { MobScreenLock } from './MobScreenLock';
import { BottomTabBar, type MobileTab } from './MobileChrome';

type Sheet =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'detail'; taskId: string }
  | { kind: 'timer' }
  | { kind: 'lock' };

export function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('home');
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' });

  const openTask = useCallback((taskId: string) => {
    setSheet({ kind: 'detail', taskId });
  }, []);

  const closeSheet = useCallback(() => setSheet({ kind: 'none' }), []);

  const openTimer = useCallback(() => setSheet({ kind: 'timer' }), []);

  // FAB-Klick: öffnet Create-Sheet
  const onFab = useCallback(() => setSheet({ kind: 'create' }), []);

  // Wenn ein Tab gewechselt wird, schließen wir offene Sheets
  const onTabChange = useCallback((next: MobileTab) => {
    setSheet({ kind: 'none' });
    setTab(next);
  }, []);

  let mainScreen: React.ReactElement;
  switch (tab) {
    case 'home':
      mainScreen = <MobScreenHeute onOpenTask={openTask} />;
      break;
    case 'board':
      mainScreen = <MobScreenBoard onOpenTask={openTask} />;
      break;
    case 'ki':
      mainScreen = <MobScreenCapture />;
      break;
    case 'me':
      mainScreen = <MobScreenProfile />;
      break;
    default:
      mainScreen = <MobScreenHeute onOpenTask={openTask} />;
  }

  return (
    <div className="mob-app">
      {mainScreen}
      <BottomTabBar active={tab} onChange={onTabChange} onFab={onFab} />

      {/* Sheets / Modals — über dem Main-Screen */}
      {sheet.kind === 'create' && (
        <div className="mob-sheet-layer">
          <MobScreenCreate
            onClose={closeSheet}
            onCreated={(_taskId, started) => {
              closeSheet();
              if (started) {
                openTimer();
              }
            }}
          />
        </div>
      )}
      {sheet.kind === 'detail' && (
        <div className="mob-sheet-layer">
          <MobScreenDetail taskId={sheet.taskId} onClose={closeSheet} />
        </div>
      )}
      {sheet.kind === 'timer' && (
        <div className="mob-sheet-layer">
          <MobScreenTimer onBack={closeSheet} />
        </div>
      )}
      {sheet.kind === 'lock' && (
        <div className="mob-sheet-layer">
          <MobScreenLock onDismiss={closeSheet} />
        </div>
      )}
    </div>
  );
}
