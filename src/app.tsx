import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  Grid2X2,
  Heart,
  LoaderCircle,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
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
import { defaultFavorites } from './catalog';
import { isTV, launchApp, loadInventory, platformBack } from './bridge';
import { moveFocus, type Direction } from './navigation';
import { loadPreferences, savePreferences } from './storage';
import { wallpapers } from './wallpapers';
import type { Category, Inventory, Page, Preferences, TVApp, TVInput } from './types';

const tabs: { id: Page; title: string }[] = [
  { id: 'home', title: 'Home' },
  { id: 'apps', title: 'Apps' },
  { id: 'inputs', title: 'Inputs' },
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [optionsApp, setOptionsApp] = useState<TVApp | null>(null);
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
  const visibleApps = inventory.apps.filter(
    (app) => showHidden || !preferences.hidden.includes(app.id),
  );
  const filteredApps = visibleApps.filter(
    (app) =>
      (!category || app.category === category) &&
      app.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const recent = preferences.recent
    .flatMap((id) => (appMap.get(id) && !preferences.hidden.includes(id) ? [appMap.get(id)!] : []))
    .slice(0, 6);
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
  }, [loading]);

  useLayoutEffect(() => {
    if (wasAmbient.current && !ambient) focusFirstApp();
    wasAmbient.current = ambient;
  }, [ambient]);

  const openPage = useCallback((next: Page) => {
    setPage(next);
    setQuery('');
    setCategory(null);
    setShowHidden(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  const onLaunch = useCallback(
    async (app: TVApp | TVInput) => {
      if (pendingLaunch.current) return;
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
    [notify],
  );

  const onOptions = useCallback((app: TVApp) => setOptionsApp(app), []);

  const actions = useRef<{ back: () => void; options: () => void; wake: () => boolean }>({
    back: () => {},
    options: () => {},
    wake: () => false,
  });
  useLayoutEffect(() => {
    actions.current = {
      back: () => {
        if (ambient) {
          setAmbient(false);
          return;
        }
        if (optionsApp) {
          setOptionsApp(null);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
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
        if (!settingsOpen && !optionsApp && id && appMap.has(id)) setOptionsApp(appMap.get(id)!);
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
            actions.current.options();
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
      onLaunch={onLaunch}
      onOptions={onOptions}
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
              A little room to breathe. Press any button to return.
            </span>
            <span className="ambient-logo">
              luma<span>✦</span>
            </span>
          </button>
        ) : (
          <div className="shell">
            <header className="header">
              <div className="logo">
                luma
                <span className="logo-spark" aria-hidden="true">
                  ✦
                </span>
              </div>
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
                <time className="header-time">{time}</time>
                <button
                  className="icon-button settings-button"
                  data-focusable="settings"
                  aria-label="Luma settings"
                  onClick={() => setSettingsOpen(true)}
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
                      <Weather
                        location={preferences.weatherLocation}
                        onConfigure={() => setSettingsOpen(true)}
                      />
                    </div>
                    <div className="landscape-credit">
                      <span className="tiny-line" />
                      {wallpaper.title.toUpperCase()}
                      <small>{wallpaper.description}</small>
                    </div>
                  </section>
                  <section className="favorites-section" aria-labelledby="favorites-heading">
                    <div className="section-heading">
                      <div>
                        <h2 id="favorites-heading">
                          Your favorites <Heart size={17} strokeWidth={1.6} />
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        data-focusable="edit-favorites"
                        onClick={() => {
                          openPage('apps');
                          notify('Hold OK on an app to add it to your favorites.');
                        }}
                      >
                        Manage Apps <Plus size={17} />
                      </button>
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
                      <div className="app-grid favorites-grid">
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
                        <button
                          className="text-button"
                          data-focusable="all-inputs"
                          onClick={() => openPage('inputs')}
                        >
                          All inputs <ChevronRight size={17} />
                        </button>
                      </div>
                      <div className="input-grid home-input-grid">
                        {inventory.inputs.slice(0, 3).map((input) => (
                          <InputCard key={input.id} input={input} onLaunch={onLaunch} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {recent.length ? (
                    <section className="recent-section">
                      <div className="section-heading">
                        <h2>Recently opened</h2>
                        <span className="section-note">Right where you left them.</span>
                      </div>
                      <div className="app-grid">
                        {recent.map((app) => renderTile(app, 'recent'))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
              {page === 'apps' ? (
                <>
                  <h1 className="sr-only">Apps</h1>
                  <div className="library-toolbar">
                    <div className="filter-tabs" aria-label="App categories">
                      {categories.map((item) => (
                        <button
                          key={item}
                          className={`filter-tab${category === item ? ' selected' : ''}`}
                          data-focusable={`filter-${item}`}
                          aria-pressed={category === item}
                          onClick={() => setCategory((current) => (current === item ? null : item))}
                        >
                          {item}
                        </button>
                      ))}
                      {category ? (
                        <button
                          className="filter-clear icon-button"
                          data-focusable="filter-clear"
                          aria-label="Clear category filter"
                          onClick={() => setCategory(null)}
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
                  {preferences.hidden.length ? (
                    <div className="library-options">
                      <button
                        className={`text-button${showHidden ? ' selected' : ''}`}
                        data-focusable="show-hidden"
                        aria-pressed={showHidden}
                        onClick={() => setShowHidden(!showHidden)}
                      >
                        {showHidden
                          ? 'Hide hidden apps'
                          : `Hidden apps (${preferences.hidden.length})`}
                      </button>
                    </div>
                  ) : null}
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
                            : 'A little room for something new.'}
                      </h3>
                      <p>
                        {error ||
                          (query
                            ? `No apps match “${query}”. Try another name.`
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
              <div className="remote-hints">
                <span>
                  <span className="keycap keycap-ok">OK</span>Open
                </span>
                <span>
                  <MoreHorizontal size={19} />
                  Hold OK for options
                </span>
              </div>
              <div className="footer-right">
                {!isTV() ? (
                  <span className="preview-badge">
                    <Monitor size={14} />
                    Desktop preview
                  </span>
                ) : null}
                <button
                  className="ambient-button"
                  data-focusable="ambient"
                  aria-label="Enter ambient mode"
                  onClick={() => setAmbient(true)}
                >
                  <Moon size={19} />
                </button>
              </div>
            </footer>
          </div>
        )}
        <AnimatePresence>
          {settingsOpen ? (
            <Settings
              key="settings"
              preferences={preferences}
              onUpdate={update}
              onClose={() => setSettingsOpen(false)}
              onRefresh={() => {
                setSettingsOpen(false);
                void refresh();
                notify('Refreshing your apps and inputs…');
              }}
              onTVSettings={() => {
                setSettingsOpen(false);
                void onLaunch({
                  id: 'com.palm.app.settings',
                  title: 'TV settings',
                  category: 'Utilities',
                  brand: 'settings',
                });
              }}
              onManage={() => {
                setSettingsOpen(false);
                openPage('apps');
              }}
            />
          ) : null}
          {optionsApp ? (
            <AppOptions
              key="options"
              app={optionsApp}
              favorites={favoriteIds}
              hidden={preferences.hidden.includes(optionsApp.id)}
              onClose={() => setOptionsApp(null)}
              onLaunch={() => {
                setOptionsApp(null);
                void onLaunch(optionsApp);
              }}
              onPin={() => {
                const pinned = favoriteIds.includes(optionsApp.id);
                update({
                  favorites: pinned
                    ? favoriteIds.filter((id) => id !== optionsApp.id)
                    : [...favoriteIds, optionsApp.id],
                  hidden: preferences.hidden.filter((id) => id !== optionsApp.id),
                });
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
                notify(
                  hidden
                    ? `${optionsApp.title} is back in your library.`
                    : `${optionsApp.title} hidden. You can restore it from Apps.`,
                );
              }}
              onMove={(offset) => {
                const next = [...favoriteIds];
                const index = next.indexOf(optionsApp.id);
                const target = index + offset;
                if (index >= 0 && target >= 0 && target < next.length) {
                  [next[index], next[target]] = [next[target], next[index]];
                  update({ favorites: next });
                }
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
