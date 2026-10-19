import { Check, ChevronRight, Clock3, Eye, Leaf, Monitor, RefreshCw, Tv } from 'lucide-react';
import { Dialog } from './dialog';
import { WeatherSettings } from './weather-settings';
import { isTV } from '../bridge';
import type { Preferences } from '../types';
import { wallpapers } from '../wallpapers';

interface Props {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onClose: () => void;
  onRefresh: () => void;
  onManage: () => void;
}

export function Settings({ preferences, onUpdate, onClose, onRefresh, onManage }: Props) {
  return (
    <Dialog title="Settings" onClose={onClose} wide>
      <div className="settings-content">
        <WeatherSettings
          location={preferences.weatherLocation}
          onChange={(weatherLocation) => onUpdate({ weatherLocation })}
        />
        <h3 className="settings-section-title">Backdrop</h3>
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
              <strong>Reduced motion</strong>
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
          <button className="setting-row" data-focusable="setting-refresh" onClick={onRefresh}>
            <RefreshCw />
            <span>
              <strong>Refresh apps & inputs</strong>
              <small>Find anything you’ve recently installed.</small>
            </span>
            <ChevronRight />
          </button>
        </div>
        <div className="about-luma">
          <img src="./mark.svg" width="36" height="36" alt="" />
          <span>
            <strong>
              Luma <small>0.1.3</small>
            </strong>
          </span>
          <span className="local-badge">
            {isTV() ? <Tv size={15} /> : <Monitor size={15} />}
            {isTV() ? 'webOS' : 'Desktop preview'}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
