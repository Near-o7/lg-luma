import type { Wallpaper } from './types';

export const wallpapers: {
  id: Wallpaper;
  title: string;
  image: string;
  description: string;
}[] = [
  {
    id: 'dunes',
    title: 'Golden hour',
    image: 'dunes.jpg',
    description: 'Somewhere worth slowing down.',
  },
  {
    id: 'san-francisco',
    title: 'San Francisco',
    image: 'san-francisco.jpg',
    description: 'The city by the bay.',
  },
  {
    id: 'midnight',
    title: 'Midnight',
    image: 'midnight.svg',
    description: 'Deep blue gradient.',
  },
  {
    id: 'summit',
    title: 'Summit',
    image: 'summit.jpg',
    description: 'Snow-covered peaks.',
  },
  {
    id: 'coast',
    title: 'Coast',
    image: 'coast.jpg',
    description: 'Ocean at dusk.',
  },
  {
    id: 'forest',
    title: 'Forest',
    image: 'forest.jpg',
    description: 'Sunlit woodland.',
  },
  {
    id: 'sand-dunes',
    title: 'Sand dunes',
    image: 'sand-dunes.jpg',
    description: 'Desert ridgelines.',
  },
  {
    id: 'lake',
    title: 'Lake',
    image: 'lake.jpg',
    description: 'Mountain reflections.',
  },
  {
    id: 'northern-lights',
    title: 'Northern lights',
    image: 'northern-lights.jpg',
    description: 'Aurora over snow.',
  },
];
