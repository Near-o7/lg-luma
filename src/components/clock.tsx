import { useEffect, useState } from 'react';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const timeFormats = [false, true].map(
  (hour12) =>
    new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12,
    }),
);
const formatTime = (now: Date, clock24: boolean) => timeFormats[clock24 ? 0 : 1].format(now);

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    };
    const tick = () => {
      if (!document.hidden) setNow(new Date());
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('webOSRelaunch', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('webOSRelaunch', tick);
    };
  }, []);
  return now;
}

export function Clock({ clock24 }: { clock24: boolean }) {
  const now = useClock();
  return (
    <time className="header-time" dateTime={now.toISOString()}>
      {formatTime(now, clock24)}
    </time>
  );
}

export function Greeting() {
  const now = useClock();
  const hour = now.getHours();
  const greeting =
    hour < 5
      ? 'One more moment.'
      : hour < 12
        ? 'Good morning.'
        : hour < 18
          ? 'Good afternoon.'
          : 'Good evening.';
  return (
    <>
      <p className="eyebrow hero-date">{dateFormat.format(now)}</p>
      <h1 id="greeting">{greeting}</h1>
    </>
  );
}

export function AmbientClock({ clock24 }: { clock24: boolean }) {
  const now = useClock();
  return (
    <>
      <span className="ambient-date">{dateFormat.format(now)}</span>
      <span className="ambient-time">{formatTime(now, clock24)}</span>
    </>
  );
}
