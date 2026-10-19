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
    id: 'alpine',
    title: 'Higher ground',
    image: 'alpine.jpg',
    description: 'A different point of view.',
  },
  {
    id: 'aurora',
    title: 'Afterglow',
    image: 'aurora.svg',
    description: 'A Luma original.',
  },
  {
    id: 'san-francisco',
    title: 'San Francisco',
    image: 'san-francisco.jpg',
    description: 'The city by the bay.',
  },
  {
    id: 'munich',
    title: 'Munich',
    image: 'munich.jpg',
    description: 'A Bavarian point of view.',
  },
  {
    id: 'tokyo',
    title: 'Tokyo',
    image: 'tokyo.jpg',
    description: 'A city with another rhythm.',
  },
];
