import {
  Accessibility,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Languages,
  RefreshCw,
  Type,
} from 'lucide-react';
import { WeatherSettings } from './weather-settings';
import type { Language, Preferences } from '../types';
import { useEffect, useState } from 'react';
import { wallpapers, wallpaperThumbnail } from '../wallpapers';
import { useTranslation, wallpaperLabel } from '../i18n';

interface Props {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onRefresh: () => void;
}

export function Settings({ preferences, onUpdate, onRefresh }: Props) {
  const { t, language } = useTranslation();
  const [section, setSection] = useState<'interface' | 'background' | 'weather'>('interface');
  const [subpage, setSubpage] = useState<
    'language' | 'weather-location' | 'temperature' | 'clock-format' | null
  >(null);
  const [subpageReturnFocus, setSubpageReturnFocus] = useState('setting-language');
  const chooseLanguage = (next: Language) => {
    onUpdate({ language: next });
    setSubpage(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[data-focusable="setting-language"]')
        ?.focus({ preventScroll: true }),
    );
  };
  const subpageReturnFocusId = (
    target: 'language' | 'weather-location' | 'temperature' | 'clock-format',
  ) => {
    switch (target) {
      case 'language':
        return 'setting-language';
      case 'temperature':
        return 'setting-temperature';
      case 'clock-format':
        return 'setting-clock-format';
      case 'weather-location':
        return 'setting-weather-location';
    }
  };
  const openSubpage = (
    next: 'language' | 'weather-location' | 'temperature' | 'clock-format',
    focusable: string,
    returnFocus?: string,
  ) => {
    setSubpage(next);
    setSubpageReturnFocus(returnFocus ?? subpageReturnFocusId(next));
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-focusable="${focusable}"]`)
        ?.focus({ preventScroll: true });
    });
  };
  const closeSubpage = () => {
    const focusable = subpageReturnFocus;
    setSubpage(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-focusable="${focusable}"]`)
        ?.focus({ preventScroll: true }),
    );
  };
  const chooseTemperature = (unit: Preferences['temperatureUnit']) => {
    onUpdate({ temperatureUnit: unit });
    setSubpage(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[data-focusable="setting-temperature"]')
        ?.focus({ preventScroll: true }),
    );
  };
  const chooseClockFormat = (clock24: boolean) => {
    onUpdate({ clock24 });
    setSubpage(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[data-focusable="setting-clock-format"]')
        ?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => {
    if (!subpage) return;
    const onBack = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.keyCode !== 461 && event.key !== 'Backspace') return;
      if (event.target instanceof HTMLInputElement && event.key === 'Backspace') return;
      event.preventDefault();
      event.stopPropagation();
      const focusable = subpageReturnFocus;
      setSubpage(null);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-focusable="${focusable}"]`)
          ?.focus({ preventScroll: true }),
      );
    };
    document.addEventListener('keydown', onBack);
    return () => document.removeEventListener('keydown', onBack);
  }, [subpage, subpageReturnFocus]);
  const sectionOrder = ['interface', 'background', 'weather'] as const;
  const sectionTitle = (id: (typeof sectionOrder)[number]) => t(id);
  const enterSection = (next: (typeof sectionOrder)[number]) => {
    setSection(next);
    setSubpage(null);
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>(`[data-focusable="${sectionFirst[next]}"]`);
      first?.focus({ preventScroll: true });
    });
  };
  const sectionFirst = {
    interface: 'setting-home-app-names',
    background: `wallpaper-${preferences.wallpaper}`,
    weather: 'setting-show-weather',
  };
  const sectionPrevious = { interface: 'weather', background: 'interface', weather: 'background' };
  const sectionNext = { interface: 'background', background: 'weather', weather: 'interface' };
  return (
    <section className="settings-page" aria-label={t('settingsRegion')}>
      <h1 className="sr-only">{t('settings')}</h1>
      <div className="settings-layout">
        <nav className="settings-sidebar" aria-label={t('settingsSections')}>
          {sectionOrder.map((id) => (
            <button
              key={id}
              className={`settings-sidebar-item${section === id ? ' selected' : ''}`}
              data-focusable={`settings-section-${id}`}
              tabIndex={section === id ? 0 : -1}
              data-focus-up={`settings-section-${sectionPrevious[id]}`}
              data-focus-down={`settings-section-${sectionNext[id]}`}
              data-focus-right={sectionFirst[id]}
              aria-current={section === id ? 'page' : undefined}
              onFocus={() => {
                if (section !== id) {
                  setSection(id);
                  setSubpage(null);
                }
              }}
              onClick={() => enterSection(id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  event.stopPropagation();
                  const first = document.querySelector<HTMLElement>(
                    `[data-focusable="${sectionFirst[id]}"]`,
                  );
                  first?.focus({ preventScroll: true });
                  return;
                }
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setSection(id);
                setSubpage(null);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(`[data-focusable="${sectionFirst[id]}"]`)
                    ?.focus({ preventScroll: true }),
                );
              }}
            >
              <span>{sectionTitle(id)}</span>
              {section === id ? <ChevronRight aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>
        <div
          className="settings-pane"
          data-focus-left={
            subpage ? `settings-subpage-back-${subpage}` : `settings-section-${section}`
          }
          key={section}
        >
          {!subpage && section === 'background' ? (
            <section className="settings-content" aria-label={t('background')}>
              <div
                className="wallpaper-options"
                data-focus-right={`wallpaper-${preferences.wallpaper}`}
              >
                {wallpapers.map((wallpaper) => (
                  <button
                    key={wallpaper.id}
                    className={`wallpaper-option${preferences.wallpaper === wallpaper.id ? ' selected' : ''}`}
                    data-focusable={`wallpaper-${wallpaper.id}`}
                    data-focus-up="settings-section-background"
                    aria-pressed={preferences.wallpaper === wallpaper.id}
                    onClick={() => onUpdate({ wallpaper: wallpaper.id })}
                  >
                    <span className="wallpaper-thumbnail">
                      <img
                        src={wallpaperThumbnail(wallpaper.image)}
                        alt=""
                        draggable={false}
                        decoding="async"
                      />
                      {preferences.wallpaper === wallpaper.id ? (
                        <span className="wallpaper-check">
                          <Check size={18} />
                        </span>
                      ) : null}
                    </span>
                    <span>{wallpaperLabel(language, wallpaper.id, wallpaper.title)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {!subpage && section === 'interface' ? (
            <section className="settings-content" aria-label={t('interface')}>
              <div className="settings-group">
                <button
                  className="setting-row"
                  role="switch"
                  aria-checked={preferences.showHomeAppNames}
                  data-focusable="setting-home-app-names"
                  data-focus-down="setting-clock-format"
                  onClick={() => onUpdate({ showHomeAppNames: !preferences.showHomeAppNames })}
                >
                  <Type />
                  <span>
                    <strong>{t('showAppNames')}</strong>
                  </span>
                  <span className="setting-state">
                    {t(preferences.showHomeAppNames ? 'stateOn' : 'stateOff')}
                  </span>
                </button>
                <button
                  className="setting-row settings-list-item"
                  data-focusable="setting-clock-format"
                  data-focus-up="setting-home-app-names"
                  data-focus-down="setting-motion"
                  onClick={() =>
                    openSubpage(
                      'clock-format',
                      preferences.clock24 ? 'clock-format-option-24' : 'clock-format-option-12',
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ')
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSubpage(
                      'clock-format',
                      preferences.clock24 ? 'clock-format-option-24' : 'clock-format-option-12',
                    );
                  }}
                >
                  <Clock3 aria-hidden="true" />
                  <span>
                    <strong>{t('clockFormat')}</strong>
                  </span>
                  <span className="setting-value">
                    {t(preferences.clock24 ? 'hour24' : 'hour12')}
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button
                  className="setting-row"
                  role="switch"
                  aria-checked={preferences.reducedMotion}
                  data-focusable="setting-motion"
                  data-focus-up="setting-clock-format"
                  data-focus-down="setting-language"
                  onClick={() => onUpdate({ reducedMotion: !preferences.reducedMotion })}
                >
                  <Accessibility />
                  <span>
                    <strong>{t('reducedMotion')}</strong>
                  </span>
                  <span className="setting-state">
                    {t(preferences.reducedMotion ? 'stateOn' : 'stateOff')}
                  </span>
                </button>
                <button
                  className="setting-row settings-list-item"
                  data-focusable="setting-language"
                  data-focus-up="setting-motion"
                  data-focus-down="setting-refresh"
                  onClick={() => openSubpage('language', `language-option-${preferences.language}`)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight' && event.key !== 'Enter' && event.key !== ' ')
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSubpage('language', `language-option-${preferences.language}`);
                  }}
                >
                  <Languages aria-hidden="true" />
                  <span>
                    <strong>{t('language')}</strong>
                  </span>
                  <span className="setting-value">
                    {t(
                      preferences.language === 'en'
                        ? 'english'
                        : preferences.language === 'de'
                          ? 'german'
                          : 'chinese',
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
              <div className="settings-group">
                <button
                  className="setting-row"
                  data-focusable="setting-refresh"
                  data-focus-up="setting-language"
                  onClick={onRefresh}
                >
                  <RefreshCw />
                  <span>
                    <strong>{t('refreshApps')}</strong>
                  </span>
                  <ChevronRight />
                </button>
              </div>
            </section>
          ) : null}
          {!subpage && section === 'weather' ? (
            <section
              className="settings-content settings-weather-content"
              aria-label={t('weather')}
            >
              <WeatherSettings
                location={preferences.weatherLocation}
                onChange={(weatherLocation) => onUpdate({ weatherLocation })}
                enabled={preferences.showWeather}
                onEnabledChange={(showWeather) => onUpdate({ showWeather })}
                unit={preferences.temperatureUnit}
                onUnitChange={(temperatureUnit) => onUpdate({ temperatureUnit })}
                focusUp="settings-section-weather"
                showTemperature={false}
                showLocationSearch={false}
              />
              <div className="settings-group">
                <button
                  className="setting-row settings-list-item"
                  data-focusable="setting-weather-location"
                  data-focus-up="setting-show-weather"
                  data-focus-down="setting-temperature"
                  onClick={() =>
                    openSubpage('weather-location', 'weather-location-query', 'setting-weather-location')
                  }
                  onKeyDown={(event) => {
                    if (!['ArrowRight', 'Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSubpage('weather-location', 'weather-location-query', 'setting-weather-location');
                  }}
                >
                  <span><strong>{t('location')}</strong></span>
                  {preferences.weatherLocation ? (
                    <span className="setting-value">{preferences.weatherLocation.name}</span>
                  ) : null}
                  <ChevronRight aria-hidden="true" />
                </button>
                <button
                  className="setting-row settings-list-item"
                  data-focusable="setting-temperature"
                  data-focus-up="setting-weather-location"
                  onClick={() => openSubpage('temperature', `temperature-option-${preferences.temperatureUnit}`)}
                  onKeyDown={(event) => {
                    if (!['ArrowRight', 'Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSubpage('temperature', `temperature-option-${preferences.temperatureUnit}`);
                  }}
                >
                  <span><strong>{t('temperature')}</strong></span>
                  <span className="setting-value">{preferences.temperatureUnit === 'celsius' ? '°C' : '°F'}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </section>
          ) : null}
          {subpage ? (
            <div
              key={subpage}
              className={`settings-subpage settings-subpage-${subpage}`}
              data-settings-subpage="true"
              role="region"
              aria-label={t(
                subpage === 'language'
                  ? 'language'
                  : subpage === 'temperature'
                    ? 'temperature'
                    : subpage === 'clock-format'
                      ? 'clockFormat'
                      : 'weather',
              )}
              data-focus-left={`settings-subpage-back-${subpage}`}
            >
              <button
                className="settings-subpage-back"
                data-focusable={`settings-subpage-back-${subpage}`}
                onClick={closeSubpage}
              >
                <ArrowLeft aria-hidden="true" />
                <span>{t('back')}</span>
              </button>
              {subpage === 'language' ? (
                <div className="settings-subpage-options" role="listbox" aria-label={t('language')}>
                  {(
                    [
                      ['en', 'english'],
                      ['de', 'german'],
                      ['zh', 'chinese'],
                    ] as const
                  ).map(([option, label]) => (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={preferences.language === option}
                      className="setting-row settings-list-item"
                      data-focusable={`language-option-${option}`}
                      data-focus-left={`settings-subpage-back-${subpage}`}
                      data-focus-up={`language-option-${option === 'en' ? 'zh' : option === 'de' ? 'en' : 'de'}`}
                      data-focus-down={`language-option-${option === 'en' ? 'de' : option === 'de' ? 'zh' : 'en'}`}
                      onClick={() => chooseLanguage(option)}
                    >
                      <span>
                        <strong>{t(label)}</strong>
                      </span>
                      {preferences.language === option ? <Check aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : subpage === 'clock-format' ? (
                <div
                  className="settings-subpage-options"
                  role="listbox"
                  aria-label={t('clockFormat')}
                >
                  {(
                    [
                      [false, 'clock-format-option-12', 'hour12'],
                      [true, 'clock-format-option-24', 'hour24'],
                    ] as const
                  ).map(([clock24, focusId, label]) => (
                    <button
                      key={focusId}
                      type="button"
                      role="option"
                      aria-selected={preferences.clock24 === clock24}
                      className="setting-row settings-list-item"
                      data-focusable={focusId}
                      data-focus-left={`settings-subpage-back-${subpage}`}
                      data-focus-up={clock24 ? 'clock-format-option-12' : 'clock-format-option-24'}
                      data-focus-down={
                        clock24 ? 'clock-format-option-12' : 'clock-format-option-24'
                      }
                      onClick={() => chooseClockFormat(clock24)}
                    >
                      <span>
                        <strong>{t(label)}</strong>
                      </span>
                      {preferences.clock24 === clock24 ? <Check aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : subpage === 'temperature' ? (
                <div
                  className="settings-subpage-options"
                  role="listbox"
                  aria-label={t('temperature')}
                >
                  {(
                    [
                      ['celsius', 'temperature-option-celsius', 'celsius'],
                      ['fahrenheit', 'temperature-option-fahrenheit', 'fahrenheit'],
                    ] as const
                  ).map(([unit, focusId, label]) => (
                    <button
                      key={focusId}
                      type="button"
                      role="option"
                      aria-selected={preferences.temperatureUnit === unit}
                      className="setting-row settings-list-item"
                      data-focusable={focusId}
                      data-focus-left={`settings-subpage-back-${subpage}`}
                      data-focus-up={
                        unit === 'celsius'
                          ? 'temperature-option-fahrenheit'
                          : 'temperature-option-celsius'
                      }
                      data-focus-down={
                        unit === 'celsius'
                          ? 'temperature-option-fahrenheit'
                          : 'temperature-option-celsius'
                      }
                      onClick={() => chooseTemperature(unit)}
                    >
                      <span>
                        <strong>{t(label)}</strong>
                      </span>
                      {preferences.temperatureUnit === unit ? <Check aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : subpage === 'weather-location' ? (
                <section className="settings-weather-subpage" aria-label={t('weather')}>
                  <WeatherSettings
                    location={preferences.weatherLocation}
                    onChange={(weatherLocation) => onUpdate({ weatherLocation })}
                    enabled={preferences.showWeather}
                    onEnabledChange={(showWeather) => onUpdate({ showWeather })}
                    unit={preferences.temperatureUnit}
                    onUnitChange={(temperatureUnit) => onUpdate({ temperatureUnit })}
                    focusUp={`settings-subpage-back-${subpage}`}
                    showControls={false}
                    showTemperature={false}
                    showLocationSearch
                  />
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
