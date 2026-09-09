import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  LocateFixed,
  MapPin,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useAccountConfigStore } from '@/shared/stores/accountConfigStore';

type WeatherResponse = {
  latitude: number;
  longitude: number;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

type Location = { latitude: number; longitude: number; label: string };

const weatherLabel = (code: number) => {
  if (code === 0) return 'Open Sky';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 95) return 'Thunderstorm';
  return 'Variable';
};

const weatherIcon = (code: number, size = 22) => {
  if (code === 0) return <Sun size={size} />;
  if (code <= 3) return <CloudSun size={size} />;
  if (code <= 48) return <Cloud size={size} />;
  if (code >= 71 && code <= 77) return <Cloud size={size} />;
  if (code >= 95) return <CloudRain size={size} />;
  return <CloudRain size={size} />;
};

const dayLabel = (date: string, index: number) => {
  if (index === 0) return 'Bugun';
  return new Intl.DateTimeFormat('uz-UZ', { weekday: 'short' }).format(
    new Date(`${date}T12:00:00`),
  );
};

export default function WeatherCard() {
  const savedLocation = useAccountConfigStore((state) => state.config.weatherLocation);
  const updateConfig = useAccountConfigStore((state) => state.updateConfig);
  const [location, setLocation] = useState<Location | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingGps, setUsingGps] = useState(false);

  useEffect(() => {
    setLocation(savedLocation ?? null);
  }, [savedLocation]);

  const loadWeather = useCallback(async (target: Location) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        latitude: String(target.latitude),
        longitude: String(target.longitude),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        forecast_days: '7',
        timezone: 'auto',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error('Weather service returned an error');
      setWeather((await response.json()) as WeatherResponse);
    } catch {
      setError('Unable to load weather information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) void loadWeather(location);
  }, [loadWeather, location]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('This device does not have geolocation.');
      return;
    }
    setUsingGps(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: 'Your location',
        };
        setLocation(nextLocation);
        void updateConfig({ weatherLocation: nextLocation });
        setUsingGps(false);
      },
      () => {
        setUsingGps(false);
        setError('Location access denied. Allow location access to load weather.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const current = weather?.current;
  const days = useMemo(() => weather?.daily.time.map((date, index) => ({
    date,
    code: weather.daily.weather_code[index],
    high: Math.round(weather.daily.temperature_2m_max[index]),
    low: Math.round(weather.daily.temperature_2m_min[index]),
    rain: weather.daily.precipitation_probability_max[index],
  })) ?? [], [weather]);

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[var(--accent-glow)] via-[#111109] to-[#111109] p-6 md:p-7 shadow-2xl relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--accent-glow)] blur-3xl" />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              <CloudSun size={14} /> Weekly weather
            </p>
            <div className="mt-2 flex items-center gap-2">
              <MapPin size={16} className="text-[var(--accent)]" />
              <h2 className="text-xl font-semibold text-white">{location?.label ?? 'Location not set'}</h2>
            </div>
            <p className="mt-1 text-xs text-white/40">Open-Meteo · No API key required</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={requestLocation} disabled={usingGps} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50" title="GPS orqali joylashuvni aniqlash">
              <LocateFixed size={14} className={usingGps ? 'animate-pulse' : ''} /> {usingGps ? 'Determining' : 'My location'}
            </button>
            <button type="button" onClick={requestLocation} disabled={loading || usingGps} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50" title="Refresh location">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{error}</p>}

        {!location ? (
          <div className="rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-glow)] p-8 text-center">
            <LocateFixed size={28} className="mx-auto mb-3 text-[var(--accent)]" />
            <p className="text-sm font-medium text-white">Location needed</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-white/45">Confirm your location to display the weather.</p>
            <button type="button" onClick={requestLocation} disabled={usingGps} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#14110E] disabled:opacity-50">{usingGps ? 'Determining…' : 'Allow my location'}</button>
          </div>
        ) : loading && !weather ? (
          <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : current ? (
          <>
            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-glow)] text-[var(--accent)]">{weatherIcon(current.weather_code, 36)}</div>
                <div>
                  <p className="text-4xl font-semibold tracking-tight text-white">{Math.round(current.temperature_2m)}°</p>
                  <p className="text-sm text-white/60">{weatherLabel(current.weather_code)} · being felt {Math.round(current.apparent_temperature)}°</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-white/50">
                <div><Thermometer size={14} className="mb-1 text-rose-300" /><span>{Math.round(current.apparent_temperature)}°</span><p>Being felt</p></div>
                <div><Droplets size={14} className="mb-1 text-cyan-300" /><span>{current.relative_humidity_2m}%</span><p>Humidity</p></div>
                <div><Wind size={14} className="mb-1 text-emerald-300" /><span>{Math.round(current.wind_speed_10m)} km/s</span><p>Wind</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {days.map((day) => (
                <div key={day.date} className="rounded-2xl border border-white/[0.06] bg-black/10 px-2 py-3 text-center transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-glow)]">
                  <p className="text-[11px] font-semibold capitalize text-white/60">{dayLabel(day.date, days.indexOf(day))}</p>
                  <div className="my-2 flex justify-center text-[var(--accent)]">{weatherIcon(day.code, 20)}</div>
                  <p className="text-sm font-semibold text-white">{day.high}° <span className="font-normal text-white/35">{day.low}°</span></p>
                  <p className="mt-1 text-[10px] text-cyan-300/70">{day.rain}% rain</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
