export type Direction = 'left' | 'right' | 'up' | 'down';
export interface FocusRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Rank by directional distance, with a strong preference for the same row or
// column. Geometry makes navigation work with grids, input cards and dialogs.
export function nextFocus(
  current: FocusRect,
  candidates: FocusRect[],
  direction: Direction,
): string | null {
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const cx = current.x + current.width / 2;
  const cy = current.y + current.height / 2;
  let best: { id: string; score: number } | undefined;
  for (const item of candidates) {
    if (item.id === current.id) continue;
    const dx = item.x + item.width / 2 - cx;
    const dy = item.y + item.height / 2 - cy;
    const forward = (horizontal ? dx : dy) * sign;
    if (forward < 3) continue;
    const cross = Math.abs(horizontal ? dy : dx);
    const aligned = horizontal
      ? Math.abs(dy) < (current.height + item.height) / 2
      : Math.abs(dx) < (current.width + item.width) / 2;
    const score = forward + cross * 2.8 + (aligned ? 0 : 1200);
    if (!best || score < best.score) best = { id: item.id, score };
  }
  return best?.id ?? null;
}

export function moveFocus(direction: Direction): void {
  const scope =
    document.querySelector('[data-focus-scope="dialog"]') ??
    document.querySelector('main')?.parentElement ??
    document;
  const nodes = [...scope.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])')].filter(
    (node) => node.getClientRects().length > 0,
  );
  const current = nodes.find((node) => node === document.activeElement);
  if (!current) {
    nodes[0]?.focus();
    return;
  }
  const rect = (node: HTMLElement): FocusRect => {
    const box = node.getBoundingClientRect();
    return {
      id: node.dataset.focusable!,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  };
  // Explicit entry/return routes take priority over geometry when a page has a
  // preferred control column. Left/right still follow the spatial layout.
  const route = current.closest(`[data-focus-${direction}]`)?.getAttribute(`data-focus-${direction}`);
  const preferred = route ? nodes.find((candidate) => candidate.dataset.focusable === route) : undefined;
  const target = preferred?.dataset.focusable ?? nextFocus(rect(current), nodes.map(rect), direction);
  const node = preferred ?? nodes.find((candidate) => candidate.dataset.focusable === target);
  if (node) {
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
}
