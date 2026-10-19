import type { Wallpaper } from './types';

export const wallpapers: {
  id: Wallpaper;
  title: string;
  detail: string;
  image: string;
  description: string;
}[] = [
  {
    id: 'dunes',
    title: 'Golden hour',
    detail: 'Desert light',
    image: 'dunes.jpg',
    description: 'Somewhere worth slowing down.',
  },
  {
    id: 'alpine',
    title: 'Higher ground',
    detail: 'Alpine light',
    image: 'alpine.jpg',
    description: 'A different point of view.',
  },
  {
    id: 'aurora',
    title: 'Afterglow',
    detail: 'Luma original',
    image: 'aurora.svg',
    description: 'A Luma original.',
  },
  {
    id: 'san-francisco',
    title: 'San Francisco',
    detail: 'Pacific light',
    image: 'san-francisco.jpg',
    description: 'The city by the bay.',
  },
  {
    id: 'munich',
    title: 'Munich',
    detail: 'Above the old town',
    image: 'munich.jpg',
    description: 'A Bavarian point of view.',
  },
  {
    id: 'tokyo',
    title: 'Tokyo',
    detail: 'City lights',
    image: 'tokyo.jpg',
    description: 'A city with another rhythm.',
  },
];
