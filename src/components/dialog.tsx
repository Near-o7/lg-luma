import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[data-focusable]')?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>('main [data-focusable]')
          ?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <motion.div
      className="dialog-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        data-focus-scope="dialog"
        className={`dialog${wide ? ' dialog-wide' : ''}`}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">MAKE IT YOURS</p>
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
          <span className="keycap">↵</span> Select <span className="keycap">esc</span> Back
        </div>
      </motion.div>
    </motion.div>
  );
}
