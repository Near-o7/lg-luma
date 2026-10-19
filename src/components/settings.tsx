import { Check, ChevronRight, Clock3, Eye, Leaf, RefreshCw } from 'lucide-react';
import { WeatherSettings } from './weather-settings';
import type { Preferences } from '../types';
import { wallpapers } from '../wallpapers';

interface Props {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onRefresh: () => void;
  onManage: () => void;
}

export function Settings({ preferences, onUpdate, onRefresh, onManage }: Props) {
  return (
    <section className="settings-page" aria-label="Luma settings">
      <h1 className="sr-only">Settings</h1>
      <div className="settings-layout">
        <section className="settings-panel settings-backdrops" aria-labelledby="backdrop-heading">
          <h2 className="settings-section-title" id="backdrop-heading">
            Backdrop
          </h2>
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
        </section>
        <div className="settings-controls">
          <section className="settings-panel">
            <WeatherSettings
              location={preferences.weatherLocation}
              onChange={(weatherLocation) => onUpdate({ weatherLocation })}
            />
          </section>
          <section className="settings-panel" aria-labelledby="preferences-heading">
            <h2 className="settings-section-title" id="preferences-heading">
              Preferences
            </h2>
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
          </section>
        </div>
      </div>
    </section>
  );
}
