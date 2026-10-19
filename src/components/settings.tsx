import {
  Check,
  ChevronRight,
  Clock3,
  Eye,
  Leaf,
  Monitor,
  Moon,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Tv,
} from 'lucide-react';
import { Dialog } from './dialog';
import { isTV } from '../bridge';
import type { Preferences, Wallpaper } from '../types';

const wallpapers: { id: Wallpaper; title: string; detail: string; image: string }[] = [
  { id: 'dunes', title: 'Golden hour', detail: 'Desert light', image: 'dunes.jpg' },
  { id: 'alpine', title: 'Higher ground', detail: 'Alpine light', image: 'alpine.jpg' },
  { id: 'aurora', title: 'Afterglow', detail: 'Luma original', image: 'aurora.svg' },
];

interface Props {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onClose: () => void;
  onRefresh: () => void;
  onAmbient: () => void;
  onTVSettings: () => void;
  onManage: () => void;
}

export function Settings({
  preferences,
  onUpdate,
  onClose,
  onRefresh,
  onAmbient,
  onTVSettings,
  onManage,
}: Props) {
  return (
    <Dialog
      title="Feels like home."
      subtitle="A few small things. Just the way you like them."
      onClose={onClose}
      wide
    >
      <div className="settings-content">
        <h3 className="settings-section-title">Your backdrop</h3>
        <div className="wallpaper-options">
          {wallpapers.map((wallpaper) => (
            <button
              key={wallpaper.id}
              className={`wallpaper-option${preferences.wallpaper === wallpaper.id ? ' selected' : ''}`}
              data-focusable={`wallpaper-${wallpaper.id}`}
              aria-pressed={preferences.wallpaper === wallpaper.id}
              onClick={() => onUpdate({ wallpaper: wallpaper.id })}
            >
              <span
                className="wallpaper-thumbnail"
                style={{ backgroundImage: `url('./wallpapers/${wallpaper.image}')` }}
              >
                {preferences.wallpaper === wallpaper.id ? (
                  <span className="wallpaper-check">
                    <Check size={18} />
                  </span>
                ) : null}
              </span>
              <span>{wallpaper.title}</span>
              <small>{wallpaper.detail}</small>
            </button>
          ))}
        </div>
        <div className="settings-group">
          <button
            className="setting-row"
            role="switch"
            aria-checked={preferences.clock24}
            data-focusable="setting-clock"
            onClick={() => onUpdate({ clock24: !preferences.clock24 })}
          >
            <Clock3 />
            <span>
              <strong>24-hour clock</strong>
              <small>A little more precision.</small>
            </span>
            <span className={`toggle${preferences.clock24 ? ' on' : ''}`}>
              <i />
            </span>
          </button>
          <button
            className="setting-row"
            role="switch"
            aria-checked={preferences.reducedMotion}
            data-focusable="setting-motion"
            onClick={() => onUpdate({ reducedMotion: !preferences.reducedMotion })}
          >
            <Leaf />
            <span>
              <strong>Gentler motion</strong>
              <small>Keep things still and simple.</small>
            </span>
            <span className={`toggle${preferences.reducedMotion ? ' on' : ''}`}>
              <i />
            </span>
          </button>
          <button className="setting-row" data-focusable="setting-manage" onClick={onManage}>
            <Eye />
            <span>
              <strong>Manage your apps</strong>
              <small>Favorites, hidden apps, and your library.</small>
            </span>
            <ChevronRight />
          </button>
        </div>
        <div className="settings-group">
          <button className="setting-row" data-focusable="setting-ambient" onClick={onAmbient}>
            <Moon />
            <span>
              <strong>A moment of quiet</strong>
              <small>Just your backdrop and the time.</small>
            </span>
            <ChevronRight />
          </button>
          <button className="setting-row" data-focusable="setting-refresh" onClick={onRefresh}>
            <RefreshCw />
            <span>
              <strong>Refresh apps & inputs</strong>
              <small>Find anything you’ve recently installed.</small>
            </span>
            <ChevronRight />
          </button>
          <button className="setting-row" data-focusable="setting-tv" onClick={onTVSettings}>
            <Settings2 />
            <span>
              <strong>TV settings</strong>
              <small>Picture, sound, network, and more.</small>
            </span>
            <ChevronRight />
          </button>
        </div>
        <div className="about-luma">
          <img src="./mark.svg" width="36" height="36" alt="" />
          <span>
            <strong>
              Luma <small>0.1.1</small>
            </strong>
            <small>A quieter home for your TV.</small>
          </span>
          <span className="local-badge">
            {isTV() ? <Tv size={15} /> : <Monitor size={15} />}
            {isTV() ? 'webOS' : 'Desktop preview'}
          </span>
        </div>
        <p className="privacy-note">
          <ShieldCheck size={14} /> Local by design. No accounts, tracking, or external requests.
        </p>
      </div>
    </Dialog>
  );
}
