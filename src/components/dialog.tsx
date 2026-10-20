import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  footerEnd,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footerEnd?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('[data-focusable]')
    )?.focus({ preventScroll: true });
    return () => {
      const target = previous?.isConnected
        ? previous
        : (document.querySelector<HTMLElement>('main [data-app-id]') ??
          document.querySelector<HTMLElement>('main [data-focusable]'));
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };
  }, []);
  return (
    <div
      className="dialog-scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        data-focus-scope="dialog"
        className={`dialog${wide ? ' dialog-wide' : ''}`}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle ? <p className="dialog-subtitle">{subtitle}</p> : null}
          </div>
          <button
            className="icon-button close-button"
            aria-label="Close"
            data-focusable="dialog-close"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
        <div className="dialog-footer">
          <div className="dialog-shortcuts">
            <span className="keycap">OK</span> Select <span className="keycap">Back</span> Close
          </div>
          {footerEnd ? <div className="dialog-footer-end">{footerEnd}</div> : null}
        </div>
      </div>
    </div>
  );
}
