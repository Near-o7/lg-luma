import { ArrowUpRight } from 'lucide-react';
import { ConnectionIcon } from './connection-icon';
import type { TVInput } from '../types';

export function InputCard({
  input,
  onLaunch,
}: {
  input: TVInput;
  onLaunch: (input: TVInput) => void;
}) {
  return (
    <button
      className={`input-card input-${input.kind}`}
      data-focusable={`input-${input.id}`}
      onClick={() => onLaunch(input)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true });
      }}
    >
      <span className="input-art">
        <ConnectionIcon input={input} />
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
