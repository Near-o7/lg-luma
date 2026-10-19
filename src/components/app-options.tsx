import { ArrowLeft, ArrowRight, Eye, EyeOff, Pin, PinOff, Play } from 'lucide-react';
import { Dialog } from './dialog';
import { Brand } from './brand';
import type { TVApp } from '../types';

interface Props {
  app: TVApp;
  favorites: string[];
  hidden: boolean;
  onClose: () => void;
  onLaunch: () => void;
  onPin: () => void;
  onHide: () => void;
  onMove: (offset: number) => void;
}

export function AppOptions({
  app,
  favorites,
  hidden,
  onClose,
  onLaunch,
  onPin,
  onHide,
  onMove,
}: Props) {
  const index = favorites.indexOf(app.id);
  const pinned = index >= 0;
  return (
    <Dialog title={app.title} subtitle={app.category} onClose={onClose}>
      <div className={`option-app-art brand-${app.brand}`}>
        <Brand app={app} />
      </div>
      <div className="settings-group">
        <button className="setting-row" data-focusable="option-open" onClick={onLaunch}>
          <Play />
          <span>
            <strong>Open app</strong>
          </span>
        </button>
        <button className="setting-row" data-focusable="option-pin" onClick={onPin}>
          {pinned ? <PinOff /> : <Pin />}
          <span>
            <strong>{pinned ? 'Remove from favorites' : 'Add to favorites'}</strong>
            <small>
              {pinned ? 'It will stay in your app library.' : 'Keep it close on your Home screen.'}
            </small>
          </span>
        </button>
        <button className="setting-row" data-focusable="option-hide" onClick={onHide}>
          {hidden ? <Eye /> : <EyeOff />}
          <span>
            <strong>{hidden ? 'Show in library' : 'Hide from library'}</strong>
            <small>{hidden ? 'Welcome back.' : 'Hide it here. Keep it installed.'}</small>
          </span>
        </button>
      </div>
      {pinned ? (
        <div className="reorder-controls">
          <span>
            Favorite {index + 1} of {favorites.length}
          </span>
          <button
            className="small-button"
            data-focusable="option-left"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move favorite left"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="small-button"
            data-focusable="option-right"
            disabled={index === favorites.length - 1}
            onClick={() => onMove(1)}
            aria-label="Move favorite right"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
