import { useState } from 'react';
import InteractiveCard from './InteractiveCard';

/**
 * The three classic orbital regimes the satellite viewer renders, drawn as a
 * cross-section of concentric shells around Earth.
 *
 * Real altitudes span two orders of magnitude (a few hundred km of LEO up to
 * ~35,786 km for GEO), so — exactly like the viewer's "Shell view" mode — we
 * place each shell on a logarithmic radial scale. That keeps the crowded low
 * shells legible while still showing GEO sitting far out. It is a visual aid,
 * not a physical scale.
 */
const EARTH_RADIUS_KM = 6371;

interface Regime {
  id: string;
  label: string;
  color: string;
  /** Inclusive altitude band above the surface, in km. */
  loKm: number;
  hiKm: number;
  period: string;
  blurb: string;
  examples: string[];
}

const REGIMES: Regime[] = [
  {
    id: 'leo',
    label: 'LEO — Low Earth Orbit',
    color: '#60a5fa',
    loKm: 160,
    hiKm: 2000,
    period: '~90 minutes',
    blurb:
      'Hugs the planet. Cheapest to reach, fastest moving, and where almost everything we launch ends up — including crewed stations and the giant internet constellations.',
    examples: ['ISS (~420 km)', 'Hubble (~540 km)', 'Starlink (~550 km)'],
  },
  {
    id: 'meo',
    label: 'MEO — Medium Earth Orbit',
    color: '#2dd4bf',
    loKm: 2000,
    hiKm: 35786,
    period: '2–24 hours',
    blurb:
      'The broad middle ground. Sparsely populated, but home to the navigation constellations whose half-day orbits keep several satellites above your horizon at once.',
    examples: ['GPS (~20,200 km)', 'Galileo (~23,200 km)', 'GLONASS (~19,100 km)'],
  },
  {
    id: 'geo',
    label: 'GEO — Geostationary Orbit',
    color: '#f59e0b',
    loKm: 35786,
    hiKm: 35786,
    period: '23h 56m (one sidereal day)',
    blurb:
      'A single razor-thin ring directly over the equator. A satellite here circles in step with Earth\u2019s spin, so from the ground it appears to hover at a fixed point in the sky.',
    examples: ['GOES weather sats', 'TV / comms relays', 'Inmarsat'],
  },
];

/**
 * Map an altitude (km) to a drawing radius in SVG units, mirroring the viewer's
 * Shell view: the surface maps to `surfaceR`, and altitude is log-stretched in
 * Earth-radius units with the exact same curve the globe uses
 * (`1 + 0.9·ln(1 + 6·altEr)`), so the diagram and the live viewer agree.
 */
function radiusForAltitude(altKm: number, surfaceR: number): number {
  const altEr = altKm / EARTH_RADIUS_KM;
  const sceneR = 1 + Math.log1p(altEr * 6) * 0.9;
  return surfaceR * sceneR;
}

export default function OrbitalRegimes() {
  const [activeId, setActiveId] = useState('leo');
  const active = REGIMES.find((r) => r.id === activeId) ?? REGIMES[0];

  // SVG geometry. The Earth sits at the centre of a 360×360 viewport.
  const cx = 180;
  const cy = 180;
  const surfaceR = 34; // px radius drawn for the globe itself

  const geoR = radiusForAltitude(35786, surfaceR);

  return (
    <InteractiveCard
      title="The orbital regimes, shell by shell"
      subtitle="Pick a regime to see where it sits and what lives there. Radii use a log scale, just like the viewer's Shell view mode."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {REGIMES.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveId(r.id)}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '0.5rem',
              border: `1px solid ${r.id === activeId ? r.color : '#262626'}`,
              background: r.id === activeId ? r.color : '#1f1f1f',
              color: r.id === activeId ? '#0a0a0a' : '#ededed',
              fontWeight: r.id === activeId ? 700 : 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {r.id.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 220px) 1fr',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <svg
          viewBox="0 0 360 360"
          style={{ width: '100%', height: 'auto', maxWidth: 240, justifySelf: 'center' }}
          role="img"
          aria-label="Cross-section of Earth showing the LEO, MEO and GEO shells"
        >
          {/* Shell bands, drawn from the outside in so inner ones sit on top. */}
          {[...REGIMES].reverse().map((r) => {
            const inner = radiusForAltitude(r.loKm, surfaceR);
            const outer =
              r.hiKm === r.loKm ? inner + 3 : radiusForAltitude(r.hiKm, surfaceR);
            const isActive = r.id === activeId;
            return (
              <circle
                key={r.id}
                cx={cx}
                cy={cy}
                r={(inner + outer) / 2}
                fill="none"
                stroke={r.color}
                strokeWidth={Math.max(outer - inner, 3)}
                strokeOpacity={isActive ? 0.85 : 0.18}
              />
            );
          })}

          {/* GEO reference ring label tick. */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + geoR}
            y2={cy}
            stroke="#3f3f46"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Earth. */}
          <circle cx={cx} cy={cy} r={surfaceR} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={surfaceR} fill="url(#earthShade)" />
          <defs>
            <radialGradient id="earthShade" cx="0.35" cy="0.35" r="0.8">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0.55} />
            </radialGradient>
          </defs>
        </svg>

        <div>
          <div style={{ fontWeight: 700, color: active.color, fontSize: '1rem' }}>
            {active.label}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1a1', margin: '0.35rem 0 0.7rem' }}>
            {active.blurb}
          </div>

          <dl style={{ margin: 0, fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <dt style={{ color: '#a1a1a1', minWidth: 78 }}>Altitude</dt>
              <dd style={{ margin: 0, color: '#ededed' }}>
                {active.loKm === active.hiKm
                  ? `${active.loKm.toLocaleString()} km`
                  : `${active.loKm.toLocaleString()}–${active.hiKm.toLocaleString()} km`}
              </dd>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <dt style={{ color: '#a1a1a1', minWidth: 78 }}>Period</dt>
              <dd style={{ margin: 0, color: '#ededed' }}>{active.period}</dd>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <dt style={{ color: '#a1a1a1', minWidth: 78 }}>Lives here</dt>
              <dd style={{ margin: 0, color: '#ededed' }}>{active.examples.join(', ')}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p style={{ marginTop: '0.9rem', fontSize: '0.78rem', color: '#a1a1a1' }}>
        {`Earth\u2019s radius is ${EARTH_RADIUS_KM.toLocaleString()} km; shell radii are log-scaled so LEO stays readable next to the distant GEO ring.`}
      </p>
    </InteractiveCard>
  );
}
