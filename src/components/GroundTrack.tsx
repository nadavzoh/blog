import { useState } from 'react';
import InteractiveCard from './InteractiveCard';

/**
 * Ground tracks.
 *
 * The path a satellite traces over the rotating Earth. For a circular orbit at
 * along-track angle u past the ascending node and inclination i:
 *
 *   latitude  = asin( sin i · sin u )
 *   longitude = lon_node + atan2( cos i · sin u, cos u ) − Earth's rotation
 *
 * Raising the inclination lifts the sine wave to higher latitudes; Earth's spin
 * shifts each successive pass westward. The reader drags inclination (including
 * past 90° into retrograde / sun-synchronous territory) and watches the wave
 * reshape on an equirectangular map.
 */

const ORBIT_PERIOD_MIN = 92; // representative LEO period
const SIDEREAL_DAY_MIN = 1436.07;
// Westward longitude shift per complete orbit, degrees.
const DRIFT_PER_ORBIT = (360 * ORBIT_PERIOD_MIN) / SIDEREAL_DAY_MIN;

const W = 360;
const H = 180;

const lonToX = (lon: number) => ((lon + 180) / 360) * W;
const latToY = (lat: number) => ((90 - lat) / 180) * H;

const PRESETS = [
  { label: 'Equatorial', inc: 0 },
  { label: 'ISS', inc: 51.6 },
  { label: 'Polar', inc: 90 },
  { label: 'Sun-sync', inc: 98 },
];

function buildTracks(incDeg: number): string[] {
  const i = (incDeg * Math.PI) / 180;
  const segments: string[] = [];
  let current: string[] = [];
  let prevLon: number | null = null;

  for (let uDeg = 0; uDeg <= 900; uDeg += 2) {
    const u = (uDeg * Math.PI) / 180;
    const lat = (Math.asin(Math.sin(i) * Math.sin(u)) * 180) / Math.PI;
    const nodeRel = (Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) * 180) / Math.PI;
    const drift = (uDeg / 360) * DRIFT_PER_ORBIT;
    // Wrap longitude into [-180, 180).
    let lon = (((nodeRel - drift + 180) % 360) + 360) % 360;
    lon -= 180;

    if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
    }
    current.push(`${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`);
    prevLon = lon;
  }
  if (current.length > 1) segments.push(current.join(' '));
  return segments;
}

export default function GroundTrack() {
  const [inc, setInc] = useState(51.6);
  const tracks = buildTracks(inc);
  const maxLat = inc <= 90 ? inc : 180 - inc;

  return (
    <InteractiveCard
      title="Ground tracks: the path beneath a satellite"
      subtitle="Inclination sets how far north and south the track reaches; Earth's spin slides each pass westward."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setInc(p.inc)}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid #262626',
              background: Math.abs(inc - p.inc) < 0.05 ? '#3b82f6' : '#1f1f1f',
              color: '#ededed',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          height: 'auto',
          background: '#0b1120',
          border: '1px solid #262626',
          borderRadius: '0.5rem',
        }}
        role="img"
        aria-label={`Ground track of a satellite at ${inc.toFixed(0)} degrees inclination`}
      >
        {/* Latitude/longitude grid. */}
        {[-60, -30, 0, 30, 60].map((lat) => (
          <line
            key={`lat-${lat}`}
            x1={0}
            y1={latToY(lat)}
            x2={W}
            y2={latToY(lat)}
            stroke={lat === 0 ? '#475569' : '#1e293b'}
            strokeWidth={lat === 0 ? 1.2 : 0.8}
          />
        ))}
        {[-120, -60, 0, 60, 120].map((lon) => (
          <line
            key={`lon-${lon}`}
            x1={lonToX(lon)}
            y1={0}
            x2={lonToX(lon)}
            y2={H}
            stroke="#1e293b"
            strokeWidth={0.8}
          />
        ))}
        {/* Maximum-latitude envelope. */}
        {maxLat > 0 && maxLat < 90 && (
          <>
            <line
              x1={0}
              y1={latToY(maxLat)}
              x2={W}
              y2={latToY(maxLat)}
              stroke="#f59e0b"
              strokeWidth={0.7}
              strokeDasharray="4 4"
              opacity={0.6}
            />
            <line
              x1={0}
              y1={latToY(-maxLat)}
              x2={W}
              y2={latToY(-maxLat)}
              stroke="#f59e0b"
              strokeWidth={0.7}
              strokeDasharray="4 4"
              opacity={0.6}
            />
          </>
        )}
        {/* The ground track itself, split where it wraps the date line. */}
        {tracks.map((pts, idx) => (
          <polyline
            key={idx}
            points={pts}
            fill="none"
            stroke="#2dd4bf"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div style={{ color: '#a1a1a1', fontSize: '0.9rem', margin: '0.9rem 0 0.4rem' }}>
        Inclination: <strong style={{ color: '#60a5fa' }}>{inc.toFixed(1)}°</strong> — reaches{' '}
        <strong style={{ color: '#f59e0b' }}>{maxLat.toFixed(1)}°</strong> north and south
        {inc > 90 ? ' (retrograde)' : ''}
      </div>
      <input
        type="range"
        min={0}
        max={135}
        step={0.1}
        value={inc}
        onChange={(e) => setInc(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6' }}
        aria-label="Inclination in degrees"
      />
    </InteractiveCard>
  );
}
