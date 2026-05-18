// BTM Mobile-App — Top-Level Shell fuer die PWA.
// Aktiviert wenn useIsMobile() === true (Viewport < 768px oder ?mobile=1).
//
// Architektur:
//   - Tab-Inhalt im .mob-screen-stage (Fade+Slide-Anim bei key-change)
//   - Bottom-Tab-Bar mit FAB
//   - Sheets ueber MobBottomSheet (Detents + Drag)
//   - Timer/Lockscreen als Full-Screen-Overlay (kein Backdrop, slidet)

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
import { MobBottomSheet } from './MobBottomSheet';

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
  const onFab = useCallback(() => setSheet({ kind: 'create' }), []);

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
      <div className="mob-screen-stage" key={tab}>
        {mainScreen}
      </div>
      <BottomTabBar active={tab} onChange={onTabChange} onFab={onFab} />

      {sheet.kind === 'create' && (
        <MobBottomSheet onClose={closeSheet} initialDetent="large">
          <MobScreenCreate
            onClose={closeSheet}
            onCreated={(_taskId, started) => {
              closeSheet();
              if (started) openTimer();
            }}
          />
        </MobBottomSheet>
      )}
      {sheet.kind === 'detail' && (
        <MobBottomSheet onClose={closeSheet} initialDetent="medium">
          <MobScreenDetail taskId={sheet.taskId} onClose={closeSheet} />
        </MobBottomSheet>
      )}
      {sheet.kind === 'timer' && (
        <div className="mob-fullscreen-overlay">
          <MobScreenTimer onBack={closeSheet} />
        </div>
      )}
      {sheet.kind === 'lock' && (
        <div className="mob-fullscreen-overlay">
          <MobScreenLock onDismiss={closeSheet} />
        </div>
      )}
    </div>
  );
}
