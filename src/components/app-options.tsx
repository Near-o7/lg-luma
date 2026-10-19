import { Eye, EyeOff, Pin, PinOff } from 'lucide-react';
import { Dialog } from './dialog';
import { Brand } from './brand';
import type { TVApp } from '../types';

interface Props {
  app: TVApp;
  favorites: string[];
  hidden: boolean;
  onClose: () => void;
  onPin: () => void;
  onHide: () => void;
}

export function AppOptions({ app, favorites, hidden, onClose, onPin, onHide }: Props) {
  const pinned = favorites.includes(app.id);
  return (
    <Dialog title={app.title} subtitle={app.category} onClose={onClose}>
      <div className={`option-app-art brand-${app.brand}`}>
        <Brand app={app} />
      </div>
      <div className="settings-group">
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
    </Dialog>
  );
}
