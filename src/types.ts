export type Page = 'home' | 'apps' | 'inputs';
export type Wallpaper = 'dunes' | 'alpine' | 'aurora';
export type Category = 'Streaming' | 'Music' | 'Gaming' | 'Utilities';

export interface TVApp {
  id: string;
  title: string;
  category: Category;
  brand: string;
}

export interface TVInput {
  id: string;
  title: string;
  port: string;
  connected: boolean | null;
  kind: 'console' | 'streamer' | 'computer' | 'hdmi';
}

export interface Preferences {
  version: 1;
  favorites: string[] | null;
  hidden: string[];
  recent: string[];
  wallpaper: Wallpaper;
  reducedMotion: boolean;
  clock24: boolean;
}

export interface Inventory {
  apps: TVApp[];
  inputs: TVInput[];
  warnings: string[];
}

export interface NativeBridge {
  onservicecallback: (raw: string) => void;
  call(uri: string, payload: string): void;
  cancel(): void;
}

declare global {
  interface Window {
    PalmServiceBridge?: new () => NativeBridge;
    webOSServiceBridge?: new () => NativeBridge;
    PalmSystem?: { identifier?: string; platformBack?: () => void };
    webOSSystem?: { identifier?: string; platformBack?: () => void };
  }
}
