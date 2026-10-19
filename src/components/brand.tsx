import {
  AppWindow,
  Coffee,
  Gamepad2,
  Globe2,
  MonitorPlay,
  Settings2,
  Triangle,
} from 'lucide-react';
import type { TVApp } from '../types';

export function Brand({ app }: { app: TVApp }) {
  switch (app.brand) {
    case 'netflix':
      return <span className="wordmark wordmark-netflix">NETFLIX</span>;
    case 'youtube':
      return (
        <span className="wordmark wordmark-youtube">
          <span className="youtube-play">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 9 6-9 6z" fill="currentColor" />
            </svg>
          </span>
          YouTube
        </span>
      );
    case 'apple':
      return (
        <span className="wordmark wordmark-apple">
          <svg viewBox="0 0 50 60" aria-hidden="true">
            <path
              fill="currentColor"
              d="M29 13c-1-7 4-12 11-13 0 7-4 12-11 13ZM25 17c7 0 9-6 17-2 3 1 6 4 7 6-12 7-9 18 1 22-3 8-8 17-14 17-4 0-6-3-11-3s-7 3-11 3C6 60 0 43 0 33 0 22 7 14 15 14c5 0 7 3 10 3Z"
            />
          </svg>
          tv
        </span>
      );
    case 'disney':
      return (
        <span className="wordmark wordmark-disney">
          <span className="disney-arc" />
          Disney<span className="disney-plus">+</span>
        </span>
      );
    case 'prime':
      return (
        <span className="wordmark wordmark-prime">
          prime video
          <svg viewBox="0 0 140 30" aria-hidden="true">
            <path
              d="M10 8q58 33 115-2M112 3l18 1-8 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    case 'plex':
      return (
        <span className="wordmark wordmark-plex">
          ple<span className="plex-x">x</span>
        </span>
      );
    case 'spotify':
      return (
        <span className="wordmark wordmark-spotify">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="24" fill="currentColor" />
            <g fill="none" stroke="#15271c" strokeLinecap="round">
              <path d="M11 18q15-6 27 2" strokeWidth="4" />
              <path d="M13 25q13-5 23 2" strokeWidth="3.5" />
              <path d="M15 32q10-4 18 1" strokeWidth="3" />
            </g>
          </svg>
          Spotify
        </span>
      );
    case 'jellyfin':
      return (
        <span className="wordmark wordmark-jellyfin">
          <Triangle strokeWidth={3} />
          Jellyfin
        </span>
      );
    case 'homebrew':
      return (
        <span className="brand-symbol">
          <Coffee />
          <span>Homebrew</span>
        </span>
      );
    case 'kodi':
      return (
        <span className="wordmark wordmark-kodi">
          <span className="kodi-symbol">❖</span>kodi
        </span>
      );
    case 'moonlight':
      return (
        <span className="brand-symbol">
          <MonitorPlay />
          <span>Moonlight</span>
        </span>
      );
    case 'browser':
      return (
        <span className="brand-symbol">
          <Globe2 />
          <span>Browser</span>
        </span>
      );
    case 'gaming':
      return (
        <span className="brand-symbol">
          <Gamepad2 />
          <span>{app.title}</span>
        </span>
      );
    case 'settings':
      return (
        <span className="brand-symbol">
          <Settings2 />
          <span>Settings</span>
        </span>
      );
    default:
      return (
        <span className="brand-symbol brand-generic">
          <AppWindow />
          <span>{app.title}</span>
        </span>
      );
  }
}
