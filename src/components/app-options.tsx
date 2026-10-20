import { Eye, EyeOff, Heart } from 'lucide-react';
import type { PointerEvent } from 'react';
import { Dialog } from './dialog';
import type { TVApp } from '../types';

interface Props {
  app: TVApp;
  favorites: string[];
  hidden: boolean;
  onClose: () => void;
  onPin: () => void;
  onHide: () => void;
}

function focusAction(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true });
}

export function AppOptions({ app, favorites, hidden, onClose, onPin, onHide }: Props) {
  const pinned = favorites.includes(app.id);
  return (
    <Dialog title={app.title} subtitle={app.category} onClose={onClose}>
      <div className="settings-group app-actions">
        <button
          className="setting-row"
          data-focusable="option-pin"
          data-autofocus="true"
          onPointerEnter={focusAction}
          onClick={onPin}
        >
          <Heart fill={pinned ? 'currentColor' : 'none'} />
          <span>
            <strong>{pinned ? 'Remove from favorites' : 'Add to favorites'}</strong>
          </span>
        </button>
        <button className="setting-row" data-focusable="option-hide" onPointerEnter={focusAction} onClick={onHide}>
          {hidden ? <Eye /> : <EyeOff />}
          <span>
            <strong>{hidden ? 'Show app' : 'Hide app'}</strong>
          </span>
        </button>
      </div>
    </Dialog>
  );
}
