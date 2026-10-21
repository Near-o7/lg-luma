import { Check, ChevronRight, RefreshCw } from 'lucide-react';
import { ConnectionIcon } from './connection-icon';
import { getInputVisibility, inputVisibilityModes } from '../inputs';
import { useTranslation } from '../i18n';
import type { InputVisibility, Preferences, TVInput } from '../types';

const visibilityLabels = { on: 'stateOn', off: 'stateOff', auto: 'stateAuto' } as const;
const visibilityDescriptions = {
  on: 'inputAlways',
  off: 'inputNever',
  auto: 'inputWhenConnected',
} as const;

export function InputSettings({
  inputs,
  visibility,
  loading,
  warning,
  onOpen,
  onRefresh,
}: {
  inputs: TVInput[];
  visibility: Preferences['inputVisibility'];
  loading: boolean;
  warning?: string;
  onOpen: (input: TVInput) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="settings-content" aria-label={t('inputs')}>
      <p className="settings-description">{t('inputVisibilityHint')}</p>
      {warning ? (
        <p className="settings-description" role="status">
          {warning}
        </p>
      ) : null}
      {inputs.length ? (
        <div className="settings-group">
          {inputs.map((input, index) => (
            <button
              key={input.id}
              className="setting-row settings-list-item"
              data-focusable={`setting-input-${input.id}`}
              data-focus-up={
                index ? `setting-input-${inputs[index - 1].id}` : 'settings-section-inputs'
              }
              data-focus-down={
                inputs[index + 1]
                  ? `setting-input-${inputs[index + 1].id}`
                  : 'setting-inputs-refresh'
              }
              onClick={() => onOpen(input)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight') return;
                event.preventDefault();
                event.stopPropagation();
                onOpen(input);
              }}
            >
              <ConnectionIcon input={input} />
              <span>
                <strong>{input.title}</strong>
                <small>
                  {input.port} ·{' '}
                  {t(
                    input.connected === true
                      ? 'connected'
                      : input.connected === false
                        ? 'noDevice'
                        : 'externalInput',
                  )}
                </small>
              </span>
              <span className="setting-value">
                {t(visibilityLabels[getInputVisibility(input.id, visibility)])}
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className="settings-description" role="status">
          {t(loading ? 'findingInputs' : 'noInputs')}
        </p>
      )}
      <div className="settings-group">
        <button
          className="setting-row"
          data-focusable="setting-inputs-refresh"
          data-focus-up={
            inputs.length
              ? `setting-input-${inputs[inputs.length - 1].id}`
              : 'settings-section-inputs'
          }
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" />
          <span>
            <strong>{t('refreshInputs')}</strong>
          </span>
        </button>
      </div>
    </section>
  );
}

export function InputVisibilitySettings({
  input,
  value,
  onChange,
}: {
  input: TVInput;
  value: InputVisibility;
  onChange: (value: InputVisibility) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="settings-subpage-options" role="listbox" aria-label={input.title}>
      {inputVisibilityModes.map((mode, index) => (
        <button
          key={mode}
          type="button"
          className="setting-row settings-list-item"
          role="option"
          aria-selected={value === mode}
          data-focusable={`input-visibility-option-${mode}`}
          data-focus-up={
            index ? `input-visibility-option-${inputVisibilityModes[index - 1]}` : 'nav-settings'
          }
          data-focus-down={`input-visibility-option-${inputVisibilityModes[(index + 1) % inputVisibilityModes.length]}`}
          onClick={() => onChange(mode)}
        >
          <span>
            <strong>{t(visibilityLabels[mode])}</strong>
            <small>{t(visibilityDescriptions[mode])}</small>
          </span>
          {value === mode ? <Check aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}
