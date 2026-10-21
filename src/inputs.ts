import { validAppId } from './catalog';
import type { InputVisibility, Preferences, TVInput } from './types';

export const inputVisibilityModes = ['on', 'off', 'auto'] as const;

export function parseInputVisibility(value: unknown): Preferences['inputVisibility'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, mode]) => validAppId(id) && (mode === 'on' || mode === 'off' || mode === 'auto'),
    ),
  );
}

export function getInputVisibility(
  id: string,
  visibility: Preferences['inputVisibility'],
): InputVisibility {
  return visibility[id] ?? 'auto';
}

export function visibleInputs(
  inputs: TVInput[],
  visibility: Preferences['inputVisibility'],
): TVInput[] {
  return inputs.filter((input) => {
    const mode = getInputVisibility(input.id, visibility);
    return mode === 'on' || (mode === 'auto' && input.connected === true);
  });
}
