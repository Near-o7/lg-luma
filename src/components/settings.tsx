import { Accessibility, Check, ChevronRight, Clock3, RefreshCw, Type } from 'lucide-react';
import { WeatherSettings } from './weather-settings';
import type { Preferences } from '../types';
import { wallpapers, wallpaperThumbnail } from '../wallpapers';

interface Props {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onRefresh: () => void;
}

export function Settings({ preferences, onUpdate, onRefresh }: Props) {
  return (
    <section className="settings-page" aria-label="Luma settings">
      <h1 className="sr-only">Settings</h1>
      <div className="settings-layout">
        <section
          className="settings-panel settings-backgrounds"
          aria-labelledby="background-heading"
        >
          <h2 className="settings-section-title" id="background-heading">
            Background
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
                  style={{ backgroundImage: `url('${wallpaperThumbnail(wallpaper.image)}')` }}
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
          <section className="settings-panel" aria-labelledby="interface-heading">
            <h2 className="settings-section-title" id="interface-heading">
              Interface
            </h2>
            <div className="settings-group">
              <button
                className="setting-row"
                role="switch"
                aria-checked={preferences.showHomeAppNames}
                data-focusable="setting-home-app-names"
                data-focus-up="nav-settings"
                onClick={() => onUpdate({ showHomeAppNames: !preferences.showHomeAppNames })}
              >
                <Type />
                <span>
                  <strong>Show app names on Home</strong>
                </span>
                <span className={`toggle${preferences.showHomeAppNames ? ' on' : ''}`}>
                  <i />
                </span>
              </button>
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
                <Accessibility />
                <span>
                  <strong>Reduced motion</strong>
                </span>
                <span className={`toggle${preferences.reducedMotion ? ' on' : ''}`}>
                  <i />
                </span>
              </button>
            </div>
            <div className="settings-group">
              <button className="setting-row" data-focusable="setting-refresh" onClick={onRefresh}>
                <RefreshCw />
                <span>
                  <strong>Refresh apps & inputs</strong>
                </span>
                <ChevronRight />
              </button>
            </div>
          </section>
          <section className="settings-panel">
            <WeatherSettings
              location={preferences.weatherLocation}
              onChange={(weatherLocation) => onUpdate({ weatherLocation })}
              enabled={preferences.showWeather}
              onEnabledChange={(showWeather) => onUpdate({ showWeather })}
              unit={preferences.temperatureUnit}
              onUnitChange={(temperatureUnit) => onUpdate({ temperatureUnit })}
            />
          </section>
        </div>
      </div>
    </section>
  );
}
