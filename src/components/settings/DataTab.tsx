import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useStore } from '../../store/store';
import { useT } from '../../i18n';

export interface DataTabProps {
  onReplayTour?: () => void;
  onClose: () => void;
}

export function DataTab({ onReplayTour, onClose }: DataTabProps) {
  const t = useT();
  const resetDemo = useStore((s) => s.resetDemo);

  return (
    <div className="set-pane">
      <div className="set-row">
        <div className="set-row-text">
          <div className="set-row-title">{t('settings.data_local_title')}</div>
          <div className="set-row-body">{t('settings.data_local_body')}</div>
        </div>
        <button
          type="button"
          className="set-row-btn danger"
          onClick={() => {
            resetDemo();
            showToast(t('toast.state_reset'));
            onClose();
          }}
        >
          <Icon name="rotate-ccw" size={13} /> {t('settings.data_local_btn')}
        </button>
      </div>

      {onReplayTour && (
        <div className="set-row">
          <div className="set-row-text">
            <div className="set-row-title">{t('settings.data_replay_title')}</div>
            <div className="set-row-body">{t('settings.data_replay_body')}</div>
          </div>
          <button
            type="button"
            className="set-row-btn"
            onClick={() => {
              onClose();
              onReplayTour();
            }}
          >
            <Icon name="compass" size={13} /> {t('settings.data_replay_btn')}
          </button>
        </div>
      )}
    </div>
  );
}
