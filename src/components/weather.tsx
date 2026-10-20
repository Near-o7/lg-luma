import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Moon,
  Sun,
} from 'lucide-react';
import type { TemperatureUnit, WeatherLocation } from '../types';
import { useWeather } from '../use-weather';
import { formatTemperature, weatherCondition } from '../weather';

const icons = {
  sun: Sun,
  moon: Moon,
  'partly-cloudy': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export function Weather({
  location,
  unit,
  onConfigure,
}: {
  location: WeatherLocation | null;
  unit: TemperatureUnit;
  onConfigure?: () => void;
}) {
  const { reading, failed, loading } = useWeather(location);
  const condition = reading ? weatherCondition(reading.code, reading.isDay) : null;
  const Icon = condition ? icons[condition.icon] : MapPin;
  const content = (
    <>
      <Icon aria-hidden="true" strokeWidth={1.6} />
      {location ? (
        <>
          <span className="weather-city">{location.name}</span>
          <span className="weather-separator" aria-hidden="true">
            ·
          </span>
          {reading ? (
            <>
              <span className="weather-temperature">
                {formatTemperature(reading.temperature, unit)}
              </span>
              <span className="weather-condition">{condition!.label}</span>
              {failed ? <small className="weather-stale">Last saved reading</small> : null}
            </>
          ) : (
            <span className="weather-condition">
              {loading ? 'Loading weather…' : 'Weather unavailable'}
            </span>
          )}
        </>
      ) : (
        <span>Set weather location</span>
      )}
    </>
  );
  if (!onConfigure) return <span className="weather-summary">{content}</span>;
  return (
    <button
      className="hero-subtitle weather-summary"
      data-focusable="weather-configure"
      onClick={onConfigure}
      aria-label={
        location
          ? `Weather in ${location.name}. Configure weather location.`
          : 'Set weather location'
      }
    >
      {content}
    </button>
  );
}
