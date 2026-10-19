import { memo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LoaderCircle, Pin } from 'lucide-react';
import { Brand } from './brand';
import type { TVApp } from '../types';

interface Props {
  app: TVApp;
  prefix: string;
  pinned?: boolean;
  launching?: boolean;
  reducedMotion: boolean;
  onLaunch: (app: TVApp) => void;
  onOptions: (app: TVApp) => void;
}

export const AppTile = memo(function AppTile({
  app,
  prefix,
  pinned,
  launching,
  reducedMotion,
  onLaunch,
  onOptions,
}: Props) {
  const [focused, setFocused] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const clearHold = () => {
    clearTimeout(hold.current);
  };
  return (
    <button
      className={`app-tile${focused ? ' is-focused' : ''}`}
      data-focusable={`${prefix}-${app.id}`}
      data-app-id={app.id}
      aria-label={`Open ${app.title}`}
      aria-haspopup="dialog"
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        clearHold();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true });
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        held.current = false;
        hold.current = setTimeout(() => {
          held.current = true;
          onOptions(app);
        }, 600);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      onContextMenu={(event) => {
        event.preventDefault();
        clearHold();
        onOptions(app);
      }}
      onClick={() => {
        clearHold();
        if (held.current) {
          held.current = false;
          return;
        }
        onLaunch(app);
      }}
    >
      <motion.span
        className={`app-face brand-${app.brand}`}
        animate={{ scale: focused && !reducedMotion ? 1.055 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <Brand app={app} />
        {pinned ? <Pin className="pin-badge" size={16} aria-label="Favorite" /> : null}
        {launching ? (
          <span className="launch-overlay">
            <LoaderCircle className="spin" />
          </span>
        ) : null}
      </motion.span>
      <span className="app-label">{app.title}</span>
    </button>
  );
});
