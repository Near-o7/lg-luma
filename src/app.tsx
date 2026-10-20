import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  CircleAlert,
  Grid2X2,
  Heart,
  LoaderCircle,
  Moon,
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { AppTile } from './components/app-tile';
import { InputCard } from './components/input-card';
import { Settings } from './components/settings';
import { AppOptions } from './components/app-options';
import { Weather } from './components/weather';
import { defaultFavorites, sortApps } from './catalog';
import { isTV, launchApp, loadInventory, platformBack } from './bridge';
import { moveFocus, type Direction } from './navigation';
import { loadPreferences, savePreferences } from './storage';
import { wallpapers } from './wallpapers';
import { moveFavorite } from './favorites';
import type { Category, Inventory, Page, Preferences, TVApp, TVInput } from './types';

const tabs: { id: Page; title: string }[] = [
  { id: 'home', title: 'Home' },
  { id: 'apps', title: 'Apps' },
  { id: 'inputs', title: 'Inputs' },
  { id: 'settings', title: 'Settings' },
];
const categories: Category[] = ['Streaming', 'Music', 'Gaming', 'Utilities'];
const focusFirstApp = () =>
  (
    document.querySelector<HTMLElement>('main [data-app-id]') ??
    document.querySelector<HTMLElement>('main [data-focusable]')
  )?.focus({ preventScroll: true });

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [inventory, setInventory] = useState<Inventory>({ apps: [], inputs: [], warnings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [optionsApp, setOptionsApp] = useState<TVApp | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const pendingLaunch = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reloadVersion = useRef(0);
  const wasAmbient = useRef(false);
  const lastReordering = useRef<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = preferences.reducedMotion || !!prefersReducedMotion;
  const appMap = useMemo(
    () => new Map(inventory.apps.map((app) => [app.id, app])),
    [inventory.apps],
  );
  const favoriteIds = preferences.favorites ?? defaultFavorites(inventory.apps);
  const favorites = favoriteIds.flatMap((id) =>
    appMap.get(id) && !preferences.hidden.includes(id) ? [appMap.get(id)!] : [],
  );
  const hiddenCount = inventory.apps.filter((app) => preferences.hidden.includes(app.id)).length;
  const visibleApps = inventory.apps.filter((app) =>
    showHidden ? preferences.hidden.includes(app.id) : !preferences.hidden.includes(app.id),
  );
  const filteredApps = sortApps(
    visibleApps.filter(
      (app) =>
        (!category || app.category === category) &&
        app.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ),
    favoriteIds,
  );
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !preferences.clock24,
  });
  const hour = now.getHours();
  const greeting =
    hour < 5
      ? 'One more moment.'
      : hour < 12
        ? 'Good morning.'
        : hour < 18
          ? 'Good afternoon.'
          : 'Good evening.';

  const notify = useCallback((text: string, isError = false) => {
    clearTimeout(toastTimer.current);
    setToast({ text, error: isError });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const update = useCallback(
    (patch: Partial<Preferences>) => setPreferences((current) => ({ ...current, ...patch })),
    [],
  );

  const refresh = useCallback(async () => {
    const version = ++reloadVersion.current;
    setLoading(true);
    setError('');
    try {
      const next = await loadInventory();
      if (version === reloadVersion.current)
        setInventory((current) => ({
          ...next,
          inputs: next.warnings.length ? current.inputs : next.inputs,
        }));
    } catch (error) {
      if (version === reloadVersion.current)
        setError(error instanceof Error ? error.message : 'Your TV couldn’t be reached.');
    } finally {
      if (version === reloadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize with the external TV inventory on mount.
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!savePreferences(preferences)) {
      // oxlint-disable-next-line react/set-state-in-effect -- Report a failed external storage write, not derived UI state.
      notify('Your changes couldn’t be saved. Device storage may be full.', true);
    }
  }, [preferences, notify]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    const resume = () => {
      if (!document.hidden) {
        setNow(new Date());
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('webOSRelaunch', resume);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('webOSRelaunch', resume);
    };
  }, [refresh]);

  useLayoutEffect(() => {
    if (!loading && document.activeElement === document.body) focusFirstApp();
  }, [loading, page]);

  useLayoutEffect(() => {
    if (wasAmbient.current && !ambient) focusFirstApp();
    wasAmbient.current = ambient;
  }, [ambient]);

  useLayoutEffect(() => {
    const id = reordering ?? lastReordering.current;
    if (id) {
      const card = [
        ...document.querySelectorAll<HTMLElement>('.favorites-grid [data-app-id]'),
      ].find((node) => node.dataset.appId === id);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    lastReordering.current = reordering;
  }, [reordering, preferences.favorites]);

  const openPage = useCallback((next: Page) => {
    setReordering(null);
    setPage(next);
    setQuery('');
    setCategory(null);
    setShowHidden(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  const onLaunch = useCallback(
    async (app: TVApp | TVInput) => {
      if (pendingLaunch.current || reordering) return;
      if (!isTV()) {
        notify(`Desktop preview · ${app.title} will open on your TV.`);
        return;
      }
      pendingLaunch.current = true;
      setLaunching(app.id);
      try {
        await launchApp(app.id);
        if (!('port' in app))
          setPreferences((current) => ({
            ...current,
            recent: [app.id, ...current.recent.filter((id) => id !== app.id)].slice(0, 12),
          }));
      } catch (error) {
        notify(error instanceof Error ? error.message : 'This app couldn’t be opened.', true);
      } finally {
        pendingLaunch.current = false;
        setLaunching(null);
      }
    },
    [notify, reordering],
  );

  const onOptions = useCallback(
    (app: TVApp) => {
      if (!reordering) setOptionsApp(app);
    },
    [reordering],
  );
  const startReordering = useCallback((app: TVApp) => setReordering(app.id), []);
  const shiftFavorite = useCallback(
    (id: string, direction: -1 | 1) => {
      setPreferences((current) => {
        const ids = current.favorites ?? defaultFavorites(inventory.apps);
        const visible = new Set(
          inventory.apps.filter((app) => !current.hidden.includes(app.id)).map((app) => app.id),
        );
        const next = moveFavorite(ids, id, direction, visible);
        return next === ids ? current : { ...current, favorites: next };
      });
    },
    [inventory.apps],
  );

  const actions = useRef<{
    back: () => void;
    options: () => void;
    hold: () => void;
    reorder: (key: string) => boolean;
    wake: () => boolean;
  }>({
    back: () => {},
    options: () => {},
    hold: () => {},
    reorder: () => false,
    wake: () => false,
  });
  useLayoutEffect(() => {
    actions.current = {
      back: () => {
        if (ambient) {
          setAmbient(false);
          return;
        }
        if (reordering) {
          setReordering(null);
          return;
        }
        if (optionsApp) {
          setOptionsApp(null);
          return;
        }
        if (query) {
          setQuery('');
          return;
        }
        if (page !== 'home') {
          openPage('home');
          requestAnimationFrame(focusFirstApp);
          return;
        }
        platformBack();
      },
      options: () => {
        const id = (document.activeElement as HTMLElement | null)?.dataset.appId;
        if (!optionsApp && id && appMap.has(id)) onOptions(appMap.get(id)!);
      },
      hold: () => {
        const node = document.activeElement as HTMLElement | null;
        const app = node?.dataset.appId ? appMap.get(node.dataset.appId) : undefined;
        if (!app || optionsApp) return;
        if (page === 'home' && node?.dataset.focusable?.startsWith('favorite-'))
          startReordering(app);
        else onOptions(app);
      },
      reorder: (key) => {
        if (!reordering) return false;
        if (key === 'ArrowLeft' || key === 'ArrowRight')
          shiftFavorite(reordering, key === 'ArrowLeft' ? -1 : 1);
        return true;
      },
      wake: () => {
        if (!ambient) return false;
        setAmbient(false);
        return true;
      },
    };
  });

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let pressed: HTMLElement | null = null;
    let held = false;
    const directions: Record<string, Direction> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    const onDown = (event: KeyboardEvent) => {
      if (actions.current.wake()) {
        event.preventDefault();
        return;
      }
      const editable = event.target instanceof HTMLInputElement;
      if (
        event.key === 'Escape' ||
        event.keyCode === 461 ||
        (!editable && event.key === 'Backspace')
      ) {
        event.preventDefault();
        if (!event.repeat) actions.current.back();
        return;
      }
      if (actions.current.reorder(event.key)) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Tab') {
        const scope = document.querySelector('[data-focus-scope="dialog"]');
        if (scope) {
          const nodes = [
            ...scope.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])'),
          ].filter((node) => node.getClientRects().length);
          const index = nodes.indexOf(document.activeElement as HTMLElement);
          if ((!event.shiftKey && index === nodes.length - 1) || (event.shiftKey && index <= 0)) {
            event.preventDefault();
            nodes[event.shiftKey ? nodes.length - 1 : 0]?.focus();
          }
        }
        return;
      }
      if (editable && event.key !== 'ArrowDown') return;
      if (directions[event.key]) {
        event.preventDefault();
        moveFocus(directions[event.key]);
        return;
      }
      if (event.key === 'ContextMenu' || event.keyCode === 457 || event.key.toLowerCase() === 'm') {
        event.preventDefault();
        actions.current.options();
        return;
      }
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        if (event.repeat || pressed) return;
        pressed = document.activeElement as HTMLElement;
        pressed?.setAttribute('data-pressed', 'true');
        held = false;
        if (pressed?.dataset.appId)
          holdTimer = setTimeout(() => {
            held = true;
            pressed?.removeAttribute('data-pressed');
            actions.current.hold();
          }, 600);
      }
    };
    const release = (event?: KeyboardEvent) => {
      if (event && event.key !== 'Enter' && event.keyCode !== 13) return;
      clearTimeout(holdTimer);
      const target = pressed;
      pressed = null;
      target?.removeAttribute('data-pressed');
      if (event && target && !held && target === document.activeElement) {
        event.preventDefault();
        target.click();
      }
      held = false;
    };
    const onBlur = () => release();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', onBlur);
    return () => {
      clearTimeout(holdTimer);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const renderTile = (app: TVApp, prefix: string, pinned = false) => (
    <AppTile
      key={app.id}
      app={app}
      prefix={prefix}
      pinned={pinned}
      launching={launching === app.id}
      reordering={prefix === 'favorite' && reordering === app.id}
      onLaunch={onLaunch}
      onOptions={onOptions}
      onHold={prefix === 'favorite' ? startReordering : undefined}
    />
  );
  const wallpaper = wallpapers.find((item) => item.id === preferences.wallpaper) ?? wallpapers[0];

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div
        className={`luma${reducedMotion ? ' reduce-motion' : ''}${ambient ? ' is-ambient' : ''}`}
      >
        <div className="landscape-fallback" />
        <div
          className={`wallpaper wallpaper-${preferences.wallpaper}`}
          style={{ backgroundImage: `url('./wallpapers/${wallpaper.image}')` }}
        />
        <div className="wallpaper-shade" />
        <div className="grain" />
        {ambient ? (
          <button
            className="ambient-screen"
            aria-label="Return to Luma"
            onClick={() => setAmbient(false)}
            onPointerMove={() => setAmbient(false)}
          >
            <span className="ambient-date">{date}</span>
            <span className="ambient-time">{time}</span>
            <span className="ambient-hint">
              {preferences.showWeather && preferences.weatherLocation ? (
                <Weather
                  location={preferences.weatherLocation}
                  unit={preferences.temperatureUnit}
                />
              ) : (
                'Press any button to return'
              )}
            </span>
          </button>
        ) : (
          <div className="shell">
            <header
              className="header"
              data-focus-down={page === 'settings' ? 'setting-home-app-names' : undefined}
            >
              <time className="header-time" dateTime={now.toISOString()}>
                {time}
              </time>
              <nav className="navigation" aria-label="Main navigation">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`nav-item${page === tab.id ? ' active' : ''}`}
                    data-focusable={`nav-${tab.id}`}
                    aria-current={page === tab.id ? 'page' : undefined}
                    onClick={() => openPage(tab.id)}
                  >
                    {page === tab.id ? (
                      <motion.span
                        className="nav-indicator"
                        layoutId="nav-indicator"
                        transition={{ type: 'spring', stiffness: 440, damping: 40 }}
                      />
                    ) : null}
                    <span>{tab.title}</span>
                  </button>
                ))}
              </nav>
              <div className="header-right">
                <button
                  className="icon-button settings-button"
                  data-focusable="tv-settings"
                  aria-label="TV settings"
                  title="TV settings"
                  onClick={() =>
                    void onLaunch({
                      id: 'com.palm.app.settings',
                      title: 'TV settings',
                      category: 'Utilities',
                      brand: 'settings',
                    })
                  }
                >
                  <Settings2 strokeWidth={1.8} />
                </button>
              </div>
            </header>
            <main className={`main page-${page}`}>
              {page === 'home' ? (
                <>
                  <section className="hero" aria-labelledby="greeting">
                    <div className="hero-copy">
                      <p className="eyebrow hero-date">{date}</p>
                      <h1 id="greeting">{greeting}</h1>
                      {preferences.showWeather ? (
                        <Weather
                          location={preferences.weatherLocation}
                          unit={preferences.temperatureUnit}
                          onConfigure={() => {
                            openPage('settings');
                            requestAnimationFrame(() => {
                              const field = document.querySelector<HTMLElement>(
                                '[data-focusable="weather-location-query"]',
                              );
                              field?.focus({ preventScroll: true });
                              field?.scrollIntoView({ block: 'nearest' });
                            });
                          }}
                        />
                      ) : null}
                    </div>
                  </section>
                  <section className="favorites-section" aria-labelledby="favorites-heading">
                    <div className="section-heading">
                      <h2 id="favorites-heading">Favorites</h2>
                      {reordering ? (
                        <span className="reorder-status" role="status">
                          Move apps
                        </span>
                      ) : null}
                    </div>
                    {loading && !inventory.apps.length ? (
                      <div className="app-grid skeleton-grid" aria-label="Loading apps">
                        {Array.from({ length: 6 }, (_, index) => (
                          <div className="skeleton" key={index} />
                        ))}
                      </div>
                    ) : error && !inventory.apps.length ? (
                      <div className="empty-state">
                        <CircleAlert />
                        <h3>A little help from your TV.</h3>
                        <p>{error}</p>
                        <button
                          className="primary-button"
                          data-focusable="retry"
                          onClick={() => void refresh()}
                        >
                          Try again <ArrowRight size={18} />
                        </button>
                      </div>
                    ) : favorites.length ? (
                      <div
                        className={`app-grid favorites-grid${preferences.showHomeAppNames ? '' : ' hide-app-labels'}${reordering ? ' is-reordering' : ''}`}
                      >
                        {favorites.map((app) => renderTile(app, 'favorite'))}
                      </div>
                    ) : (
                      <div className="empty-state empty-favorites">
                        <Heart />
                        <h3>Make room for your favorites.</h3>
                        <p>Find an app you love. Hold OK to pin it here.</p>
                        <button
                          className="primary-button"
                          data-focusable="browse-apps"
                          onClick={() => openPage('apps')}
                        >
                          Explore your apps <ArrowRight size={18} />
                        </button>
                      </div>
                    )}
                  </section>
                  {inventory.inputs.length ? (
                    <section className="home-inputs" aria-labelledby="inputs-heading">
                      <div className="section-heading">
                        <h2 id="inputs-heading">Inputs</h2>
                      </div>
                      <div className="input-grid home-input-grid">
                        {inventory.inputs.slice(0, 3).map((input) => (
                          <InputCard key={input.id} input={input} onLaunch={onLaunch} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
              {page === 'apps' ? (
                <>
                  <h1 className="sr-only">Apps</h1>
                  <div
                    className="library-toolbar"
                    onFocus={(event) =>
                      event.currentTarget.closest('main')?.scrollTo({ top: 0, behavior: 'instant' })
                    }
                  >
                    <div className="filter-tabs" aria-label="App categories">
                      {categories.map((item) => (
                        <button
                          key={item}
                          className={`filter-tab${category === item ? ' selected' : ''}`}
                          data-focusable={`filter-${item}`}
                          aria-pressed={category === item}
                          onClick={() => {
                            setShowHidden(false);
                            setCategory((current) => (current === item ? null : item));
                          }}
                        >
                          {item}
                        </button>
                      ))}
                      {hiddenCount ? (
                        <button
                          className={`filter-tab${showHidden ? ' selected' : ''}`}
                          data-focusable="filter-hidden"
                          aria-pressed={showHidden}
                          onClick={() => {
                            setCategory(null);
                            setShowHidden((current) => !current);
                          }}
                        >
                          Hidden ({hiddenCount})
                        </button>
                      ) : null}
                      {category || showHidden ? (
                        <button
                          className="filter-clear icon-button"
                          data-focusable="filter-clear"
                          aria-label="Clear category filter"
                          onClick={() => {
                            setCategory(null);
                            setShowHidden(false);
                          }}
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                    <label className="search-field">
                      <Search size={21} />
                      <input
                        aria-label="Find an app"
                        data-focusable="search"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Find an app"
                        autoComplete="off"
                      />
                      {query ? (
                        <button
                          data-focusable="search-clear"
                          aria-label="Clear search"
                          onClick={() => setQuery('')}
                        >
                          <X size={18} />
                        </button>
                      ) : null}
                    </label>
                  </div>
                  {filteredApps.length ? (
                    <div className="app-grid library-grid">
                      {filteredApps.map((app) => (
                        <div
                          className={preferences.hidden.includes(app.id) ? 'hidden-app' : ''}
                          key={app.id}
                        >
                          {renderTile(app, 'library', favoriteIds.includes(app.id))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Grid2X2 />
                      <h3>
                        {loading
                          ? 'Finding your apps…'
                          : query
                            ? 'Nothing here. Yet.'
                            : showHidden
                              ? 'No hidden apps.'
                              : 'A little room for something new.'}
                      </h3>
                      <p>
                        {error ||
                          (query
                            ? `No apps match “${query}”. Try another name.`
                            : showHidden
                              ? 'Apps you hide will appear here.'
                              : 'Apps in this category will appear here.')}
                      </p>
                      {error ? (
                        <button
                          className="primary-button"
                          data-focusable="library-retry"
                          onClick={() => void refresh()}
                        >
                          Try again
                        </button>
                      ) : null}
                    </div>
                  )}
                </>
              ) : null}
              {page === 'inputs' ? (
                <>
                  <h1 className="sr-only">Inputs</h1>
                  {inventory.inputs.length ? (
                    <div className="input-grid full-input-grid">
                      {inventory.inputs.map((input) => (
                        <InputCard key={input.id} input={input} onLaunch={onLaunch} />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Tv />
                      <h3>{loading ? 'Finding your inputs…' : 'No inputs to show.'}</h3>
                      <p>
                        {inventory.warnings[0] ||
                          'Your TV’s physical HDMI inputs will appear here.'}
                      </p>
                      <button
                        className="primary-button"
                        data-focusable="inputs-retry"
                        onClick={() => void refresh()}
                      >
                        Refresh inputs
                      </button>
                    </div>
                  )}
                </>
              ) : null}
              {page === 'settings' ? (
                <Settings
                  preferences={preferences}
                  onUpdate={update}
                  onRefresh={() => {
                    void refresh();
                    notify('Refreshing your apps and inputs…');
                  }}
                />
              ) : null}
              {error && inventory.apps.length ? (
                <div className="inventory-warning">
                  <CircleAlert size={18} />
                  <span>{error}</span>
                  <button data-focusable="refresh-error" onClick={() => void refresh()}>
                    Retry
                  </button>
                </div>
              ) : null}
            </main>
            <footer className="footer">
              {reordering || page !== 'home' ? (
                <div className="remote-hints" id={reordering ? 'reorder-instructions' : undefined}>
                  {reordering ? (
                    <>
                      <span>
                        <span className="keycap">← →</span>Move
                      </span>
                      <span>
                        <span className="keycap">Back</span>Done
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <span className="keycap keycap-ok">OK</span>
                        {page === 'settings' ? 'Select' : 'Open'}
                      </span>
                      <span>
                        {page === 'settings' ? (
                          <>
                            <span className="keycap">Back</span>Home
                          </>
                        ) : (
                          <>
                            <MoreHorizontal size={19} />
                            Hold OK for options
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>
              ) : null}
              <div className="footer-right">
                {page === 'settings' ? (
                  <span className="settings-version" aria-label="Luma version 0.1.7">
                    v0.1.7
                  </span>
                ) : (
                  <button
                    className="ambient-button"
                    data-focusable="ambient"
                    aria-label="Enter ambient mode"
                    onClick={() => {
                      setReordering(null);
                      setAmbient(true);
                    }}
                  >
                    <Moon size={19} />
                  </button>
                )}
              </div>
            </footer>
          </div>
        )}
        <AnimatePresence>
          {optionsApp ? (
            <AppOptions
              key="options"
              app={optionsApp}
              favorites={favoriteIds}
              hidden={preferences.hidden.includes(optionsApp.id)}
              onClose={() => setOptionsApp(null)}
              onPin={() => {
                const pinned = favoriteIds.includes(optionsApp.id);
                update({
                  favorites: pinned
                    ? favoriteIds.filter((id) => id !== optionsApp.id)
                    : [...favoriteIds, optionsApp.id],
                  hidden: preferences.hidden.filter((id) => id !== optionsApp.id),
                });
                if (showHidden && hiddenCount === 1 && preferences.hidden.includes(optionsApp.id))
                  setShowHidden(false);
                setOptionsApp(null);
                notify(
                  pinned
                    ? `${optionsApp.title} removed from favorites.`
                    : `${optionsApp.title} added to favorites.`,
                );
              }}
              onHide={() => {
                const hidden = preferences.hidden.includes(optionsApp.id);
                update({
                  hidden: hidden
                    ? preferences.hidden.filter((id) => id !== optionsApp.id)
                    : [...preferences.hidden, optionsApp.id],
                });
                setOptionsApp(null);
                if (hidden && hiddenCount === 1) setShowHidden(false);
                notify(
                  hidden
                    ? `${optionsApp.title} is back in your library.`
                    : `${optionsApp.title} hidden. You can restore it from Apps.`,
                );
              }}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {toast ? (
            <motion.div
              className={`toast${toast.error ? ' toast-error' : ''}`}
              role={toast.error ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            >
              {toast.error ? <CircleAlert size={20} /> : <Sparkles size={20} />}
              <span>{toast.text}</span>
              <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
                <X size={18} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {launching ? (
          <div className="launch-status" role="status">
            <LoaderCircle className="spin" size={18} />
            Opening…
          </div>
        ) : null}
      </div>
    </MotionConfig>
  );
}
