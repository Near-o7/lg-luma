import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, MapPin, Search, X } from 'lucide-react';
import type { WeatherLocation } from '../types';
import { clearWeatherCache, locationDetail, locationKey, searchLocations } from '../weather';

export function WeatherSettings({
  location,
  onChange,
}: {
  location: WeatherLocation | null;
  onChange: (location: WeatherLocation | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const search = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setMessage('');
    setResults([]);
    if (query.trim().length < 2) {
      setMessage('Enter a city or postcode with at least two characters.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const places = await searchLocations(query, request.signal);
      if (request.signal.aborted) return;
      setResults(places);
      if (!places.length) setMessage('No locations found. Try another city or postcode.');
    } catch {
      if (!request.signal.aborted)
        setMessage('Location search is unavailable. Check your connection and try again.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return (
    <section className="weather-settings" aria-labelledby="weather-location-heading">
      <h2 className="settings-section-title" id="weather-location-heading">
        Weather location
      </h2>
      {location ? (
        <div className="saved-location">
          <MapPin size={18} />
          <span>
            <strong>{location.name}</strong>
            <small>{locationDetail(location)}</small>
          </span>
          <button
            className="icon-button"
            type="button"
            data-focusable="weather-location-clear"
            aria-label="Remove weather location"
            onClick={() => {
              controller.current?.abort();
              setLoading(false);
              clearWeatherCache();
              onChange(null);
              setResults([]);
              setMessage('');
              searchButton.current?.focus({ preventScroll: true });
            }}
          >
            <X size={17} />
          </button>
        </div>
      ) : null}
      <form
        className="location-search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            aria-label="City or postcode"
            data-focusable="weather-location-query"
            value={query}
            onChange={(event) => {
              controller.current?.abort();
              setLoading(false);
              setResults([]);
              setMessage('');
              setQuery(event.target.value);
            }}
            placeholder="City or postcode"
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <button
          ref={searchButton}
          className="small-button location-search-button"
          type="submit"
          data-focusable="weather-location-search"
          aria-label="Search locations"
        >
          {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
        </button>
      </form>
      {message ? (
        <p className="location-message" role="status">
          {message}
        </p>
      ) : null}
      {results.length ? (
        <div className="location-results" aria-label="Location results">
          {results.map((place) => (
            <button
              key={locationKey(place)}
              className="setting-row"
              data-focusable={`location-${locationKey(place)}`}
              onClick={() => {
                onChange(place);
                setResults([]);
                setMessage('');
                searchButton.current?.focus({ preventScroll: true });
              }}
            >
              <MapPin />
              <span>
                <strong>{place.name}</strong>
                <small>{locationDetail(place)}</small>
              </span>
              {location && locationKey(location) === locationKey(place) ? (
                <Check size={18} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      <p className="weather-attribution">
        Weather by{' '}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          data-focusable="weather-attribution"
        >
          Open-Meteo
        </a>
        . Updates every 15 minutes. °C.
      </p>
    </section>
  );
}
