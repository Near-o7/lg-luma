import { ConnectionIcon } from './connection-icon';
import { InputStatus } from './input-status';
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
        <span className="input-title">{input.port}</span>
        <span className="input-state">
          <InputStatus input={input} />
        </span>
      </span>
    </button>
  );
}
