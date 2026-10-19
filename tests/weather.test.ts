import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreferences } from '../src/storage.ts';
import {
  fetchWeather,
  parseLocation,
  parseWeather,
  searchLocations,
  weatherCondition,
} from '../src/weather.ts';

const vienna = {
  name: 'Vienna',
  region: 'State of Vienna',
  country: 'Austria',
  latitude: 48.20849,
  longitude: 16.37208,
};

test('old saved preferences migrate without enabling weather and invalid coordinates are rejected', () => {
  assert.equal(parsePreferences('{"version":1,"favorites":["netflix"]}').weatherLocation, null);
  const preferences = parsePreferences(JSON.stringify({ version: 1, weatherLocation: vienna }));
  assert.deepEqual(preferences.weatherLocation, vienna);
  assert.equal(preferences.showWeather, true);
  assert.equal(preferences.showHomeAppNames, false);
  const configured = parsePreferences(
    JSON.stringify({
      version: 1,
      weatherLocation: vienna,
      showWeather: false,
      showHomeAppNames: true,
    }),
  );
  assert.equal(configured.showWeather, false);
  assert.equal(configured.showHomeAppNames, true);
  assert.deepEqual(configured.weatherLocation, vienna);
  assert.equal(parseLocation({ ...vienna, latitude: Infinity }), null);
  assert.equal(parseLocation({ ...vienna, longitude: 181 }), null);
  assert.equal(parseLocation({ ...vienna, name: '' }), null);
});

test('location search encodes the query and excludes malformed or duplicate results', async (t) => {
  let request: URL | undefined;
  t.mock.method(globalThis, 'fetch', async (input: unknown, options: RequestInit) => {
    request = new URL(String(input));
    assert.equal(options.credentials, 'omit');
    return new Response(
      JSON.stringify({
        results: [
          { ...vienna, admin1: vienna.region },
          { ...vienna, admin1: vienna.region },
          { name: 'Invalid', latitude: 500, longitude: 30 },
        ],
      }),
      { status: 200 },
    );
  });
  assert.deepEqual(await searchLocations(' Vienna & surroundings '), [vienna]);
  assert.equal(request!.origin, 'https://geocoding-api.open-meteo.com');
  assert.equal(request!.searchParams.get('name'), 'Vienna & surroundings');
});

test('short search terms make no network request and service failures remain actionable', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(searchLocations('a'), /at least two/);
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(searchLocations('Vienna'), /unavailable/);
});

test('weather requests use the chosen coordinates and validate the current reading', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.open-meteo.com');
    assert.equal(url.searchParams.get('latitude'), String(vienna.latitude));
    assert.equal(url.searchParams.get('longitude'), String(vienna.longitude));
    assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
    return new Response(
      JSON.stringify({ current: { temperature_2m: 12.3, weather_code: 3, is_day: 0 } }),
    );
  });
  assert.deepEqual(await fetchWeather(vienna), { temperature: 12.3, code: 3, isDay: false });
  for (const current of [
    null,
    { temperature_2m: null, weather_code: 3, is_day: 1 },
    { temperature_2m: 500, weather_code: 3, is_day: 1 },
    { temperature_2m: 14, weather_code: -1, is_day: 1 },
  ])
    assert.throws(() => parseWeather({ current }), /unreadable/);
});

test('weather conditions handle night, fog, snow, showers and thunderstorms', () => {
  assert.deepEqual(weatherCondition(0, false), { label: 'Clear night', icon: 'moon' });
  assert.equal(weatherCondition(48, true).icon, 'fog');
  assert.equal(weatherCondition(85, true).icon, 'snow');
  assert.equal(weatherCondition(82, true).icon, 'rain');
  assert.equal(weatherCondition(99, true).icon, 'storm');
});
