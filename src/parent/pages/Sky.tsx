import { useState } from 'react';
import { lookupZip } from '../../lib/zcta';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Button, Card, Field, Line, Section, Segmented, Stack, TextInput, Toggle, useToast } from '../ui/kit';
import styles from './pages.module.css';
import { useSettings } from './Settings';

/**
 * The sky over the house. With a rough idea of where the family lives, the wall's sun rises and sets with the
 * real one, tonight's moon is tonight's moon, and (if switched on) it rains on the wall when it rains outside.
 *
 * "Where" is never an address: it is the middle of a postcode area, rounded to about a kilometre. A US ZIP code
 * is looked up on this phone and is not sent anywhere.
 */

const SKY_WORDS: Record<string, string> = {
  clear: 'clear',
  partly: 'some cloud',
  cloudy: 'cloudy',
  fog: 'foggy',
  drizzle: 'drizzle',
  rain: 'rain',
  storm: 'a storm',
  snow: 'snow',
  wind: 'windy',
};

export function Sky() {
  const parent = useParent();
  const toast = useToast();
  const [settings, set, guardian] = useSettings();
  const { view } = parent;
  const [zip, setZip] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const place = settings.location;

  const save = (position: { lat: number; lon: number }, label: string) => {
    parent.tell('household.settings', {
      patch: {
        location: {
          lat: Math.round(position.lat * 100) / 100,
          lon: Math.round(position.lon * 100) / 100,
          label,
        },
      },
    });
    setProblem(null);
    toast('The sky now follows that place.');
  };

  const byZip = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const found = await lookupZip(zip);
      if (found) save(found, `ZIP ${zip.trim()}`);
      else setProblem('That ZIP code is not one with an area on the map. Try a neighbouring one.');
    } catch {
      setProblem('The ZIP code table could not be loaded just now.');
    } finally {
      setBusy(false);
    }
  };

  const byPhone = () => {
    if (!navigator.geolocation) {
      setProblem('This phone will not say where it is. Use a ZIP code instead.');
      return;
    }
    setBusy(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        save(
          { lat: position.coords.latitude, lon: position.coords.longitude },
          'This phone’s rough position',
        );
      },
      () => {
        setBusy(false);
        setProblem('The phone did not share its position. Use a ZIP code instead.');
      },
      { enableHighAccuracy: false, maximumAge: 3_600_000, timeout: 15_000 },
    );
  };

  const manual = () => {
    const a = Number(lat);
    const b = Number(lon);
    if (
      lat.trim() === '' ||
      lon.trim() === '' ||
      Number.isNaN(a) ||
      Number.isNaN(b) ||
      Math.abs(a) > 90 ||
      Math.abs(b) > 180
    ) {
      setProblem('Latitude is between −90 and 90, longitude between −180 and 180.');
      return;
    }
    save({ lat: a, lon: b }, 'A position typed in');
  };

  return (
    <>
      <PageHead title="Sky and weather" onBack={() => parent.go('more')} />
      <Section title="Day and night">
        <Card>
          <Toggle
            label="The sky follows the real sun and moon"
            hint="Off: it is always a plain daytime sky."
            checked={settings.sky.daylight}
            onChange={(daylight) => set({ sky: { daylight } })}
            testId="set-daylight"
          />
        </Card>
      </Section>

      <Section
        title="Where you are, roughly"
        hint="Worked out on the wall itself from this position: sunrise, sunset and the moon need no service at all."
      >
        <Card tone={place ? 'sage' : undefined} testId="place">
          {place ? (
            <Stack gap="s">
              <p>
                <strong>{place.label || 'A position'}</strong> — about {place.lat.toFixed(2)},{' '}
                {place.lon.toFixed(2)} (rounded to roughly a kilometre).
              </p>
              {guardian && (
                <Line>
                  <Button
                    size="s"
                    onClick={() => {
                      parent.tell('household.settings', {
                        patch: { location: null, sky: { weather: false } },
                      });
                      toast('Forgotten. The sky goes by the clock.');
                    }}
                  >
                    Forget it
                  </Button>
                </Line>
              )}
            </Stack>
          ) : (
            <p>Not set. The sky goes by the clock: light from about half past six until half past seven.</p>
          )}
        </Card>
        {guardian && (
          <Card>
            <Stack>
              {problem && (
                <p className={styles.warning} role="alert">
                  {problem}
                </p>
              )}
              <Field
                label="A US ZIP code"
                hint="Looked up on this phone. The ZIP code itself is not sent or stored as an address."
              >
                <Line>
                  <div style={{ width: 150 }}>
                    <TextInput
                      value={zip}
                      onChange={(event) => setZip(event.target.value.replace(/\D/g, '').slice(0, 5))}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="12345"
                      testId="zip-input"
                    />
                  </div>
                  <Button
                    tone="primary"
                    busy={busy}
                    disabled={zip.length !== 5}
                    onClick={() => void byZip()}
                    testId="zip-find"
                  >
                    Use it
                  </Button>
                </Line>
              </Field>
              <Line>
                <Button onClick={byPhone} disabled={busy}>
                  Use this phone’s position
                </Button>
              </Line>
              <details>
                <summary>Outside the US, or prefer to type it</summary>
                <Stack gap="s">
                  <Line>
                    <Field label="Latitude">
                      <TextInput
                        value={lat}
                        onChange={(event) => setLat(event.target.value)}
                        inputMode="decimal"
                        placeholder="51.5"
                      />
                    </Field>
                    <Field label="Longitude">
                      <TextInput
                        value={lon}
                        onChange={(event) => setLon(event.target.value)}
                        inputMode="decimal"
                        placeholder="-0.1"
                      />
                    </Field>
                  </Line>
                  <Button onClick={manual}>Use these</Button>
                </Stack>
              </details>
            </Stack>
          </Card>
        )}
      </Section>

      <Section title="Weather">
        <Card>
          <Stack gap="s">
            <Toggle
              label="Show the real weather"
              hint="The server asks a free weather service a few times an hour, sending only the rounded position above. The wall itself asks nobody."
              checked={settings.sky.weather}
              disabled={!place}
              onChange={(weather) => set({ sky: { weather } })}
              testId="set-weather"
            />
            {!place && <p className={styles.itemNote}>Set a position first.</p>}
            {settings.sky.weather && (
              <>
                <Segmented
                  label="Temperature in"
                  value={settings.sky.units}
                  onChange={(units) => set({ sky: { units } })}
                  options={[
                    { value: 'us', label: '°F' },
                    { value: 'metric', label: '°C' },
                  ]}
                />
                <p data-testid="weather-now">
                  {view.weather ? (
                    <>
                      <strong>Now:</strong> {SKY_WORDS[view.weather.state] ?? view.weather.state}
                      {view.weather.temperature !== null &&
                        `, ${view.weather.temperature}°${view.weather.units === 'us' ? 'F' : 'C'}`}
                      {view.weather.stale ? ' (the last reading; the service has not answered lately)' : ''}
                    </>
                  ) : (
                    'No reading yet. One arrives within a few minutes of the wall being on.'
                  )}
                </p>
              </>
            )}
          </Stack>
        </Card>
        <p className={styles.itemNote}>
          Weather from the U.S. National Weather Service in the United States, and from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>{' '}
          elsewhere (CC BY 4.0).
        </p>
      </Section>
    </>
  );
}
