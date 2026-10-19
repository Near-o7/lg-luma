import { Gamepad2, Monitor, Tv, Cable, ArrowUpRight } from 'lucide-react';
import type { TVInput } from '../types';

export function InputCard({
  input,
  onLaunch,
  compact = false,
}: {
  input: TVInput;
  onLaunch: (input: TVInput) => void;
  compact?: boolean;
}) {
  const Icon = { console: Gamepad2, streamer: Tv, computer: Monitor, hdmi: Cable }[input.kind];
  return (
    <button
      className={`input-card input-${input.kind}${compact ? ' input-compact' : ''}`}
      data-focusable={`input-${input.id}`}
      onClick={() => onLaunch(input)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true });
      }}
    >
      <span className="input-art">
        <Icon strokeWidth={1.25} />
      </span>
      <span className="input-info">
        <span className="input-port">{input.port}</span>
        <span className="input-title">{input.title}</span>
        <span className="input-state">
          {input.connected === true ? (
            <>
              <i className="status-dot" />
              Connected
            </>
          ) : input.connected === false ? (
            'No device connected'
          ) : (
            'External input'
          )}
        </span>
      </span>
      <ArrowUpRight className="input-arrow" size={22} />
    </button>
  );
}
