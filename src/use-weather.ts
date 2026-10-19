import { useEffect, useState } from 'react';
import type { WeatherLocation } from './types';
import {
  fetchWeather,
  locationKey,
  readWeatherCache,
  saveWeatherCache,
  WEATHER_REFRESH_MS,
  type CachedWeather,
} from './weather';

interface WeatherState {
  cache: CachedWeather | null;
  key: string;
  failed: boolean;
}

export function useWeather(location: WeatherLocation | null) {
  const [state, setState] = useState<WeatherState | null>(null);
  useEffect(() => {
    if (!location) return;
    const key = locationKey(location);
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!disposed && !document.hidden) timer = setTimeout(() => void refresh(), delay);
    };
    const refresh = async () => {
      if (disposed || document.hidden) return;
      clearTimeout(timer);
      controller?.abort();
      const cached = readWeatherCache(location);
      const age = cached ? Date.now() - cached.updatedAt : Infinity;
      if (cached && age < WEATHER_REFRESH_MS) {
        setState({ key, cache: cached, failed: false });
        schedule(WEATHER_REFRESH_MS - age);
        return;
      }
      const request = new AbortController();
      controller = request;
      try {
        const reading = await fetchWeather(location, request.signal);
        if (disposed || request.signal.aborted) return;
        const cache = { key, updatedAt: Date.now(), reading };
        saveWeatherCache(cache);
        setState({ key, cache, failed: false });
        schedule(WEATHER_REFRESH_MS);
      } catch {
        if (disposed || request.signal.aborted) return;
        setState({ key, cache: cached, failed: true });
        schedule(5 * 60 * 1000);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void refresh();
    };
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the external weather cache and API when the selected city changes.
    void refresh();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', visibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', visibility);
    };
  }, [location]);
  const current = location && state?.key === locationKey(location) ? state : null;
  return {
    reading: current?.cache?.reading ?? null,
    failed: current?.failed ?? false,
    loading: !!location && !current,
  };
}
