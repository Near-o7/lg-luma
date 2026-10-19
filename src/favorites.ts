// Move between visible favorites while preserving slots for hidden/unavailable
// apps. Back exits move mode; each successful move is saved immediately.
export function moveFavorite(
  ids: string[],
  id: string,
  direction: -1 | 1,
  visible: ReadonlySet<string>,
): string[] {
  const shown = ids.filter((candidate) => visible.has(candidate));
  const position = shown.indexOf(id);
  const neighbor = shown[position + direction];
  if (position < 0 || !neighbor) return ids;
  const next = [...ids];
  const from = next.indexOf(id);
  const to = next.indexOf(neighbor);
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
