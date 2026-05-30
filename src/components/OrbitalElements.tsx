import { useState } from 'react';
import InteractiveCard from './InteractiveCard';

/**
 * Orbital elements & TLEs.
 *
 * Two parts:
 *  1. A colour-annotated real two-line element set, so the reader can see which
 *     numbers carry which orbital element — the same fields the live viewer's
 *     detail panel reads out.
 *  2. A face-on sketch of the orbital plane driven by two sliders. Eccentricity
 *     changes the *shape* of the ellipse; the argument of perigee *rotates* it
 *     within the plane (where perigee points). Inclination and RAAN orient that
 *     plane in 3D and are described rather than drawn.
 */

/** A segment of a TLE line: plain text, or a highlighted, labelled field. */
interface Seg {
  text: string;
  label?: string;
  color?: string;
}

const LINE1: Seg[] = [
  { text: '1 ' },
  { text: '25544', label: 'Catalog no.', color: '#60a5fa' },
  { text: 'U 98067A   ' },
  { text: '24015.50000000', label: 'Epoch', color: '#2dd4bf' },
  { text: '  .00016717  00000-0  10270-3 0  900' },
  { text: '5' },
];

const LINE2: Seg[] = [
  { text: '2 25544 ' },
  { text: '51.6416', label: 'Inclination', color: '#f59e0b' },
  { text: ' ' },
  { text: '247.4627', label: 'RAAN', color: '#a78bfa' },
  { text: ' ' },
  { text: '0006703', label: 'Eccentricity', color: '#f472b6' },
  { text: ' ' },
  { text: '130.5360', label: 'Arg. of perigee', color: '#34d399' },
  { text: ' ' },
  { text: '325.0288', label: 'Mean anomaly', color: '#fbbf24' },
  { text: ' ' },
  { text: '15.49815350', label: 'Mean motion', color: '#38bdf8' },
  { text: '12345' },
];

function renderLine(segs: Seg[], onHover: (s: Seg | null) => void) {
  return segs.map((s, i) =>
    s.label ? (
      <span
        key={i}
        onMouseEnter={() => onHover(s)}
        onMouseLeave={() => onHover(null)}
        style={{
          color: s.color,
          background: '#0a0a0a',
          padding: '0 1px',
          borderRadius: 3,
          cursor: 'help',
          fontWeight: 700,
        }}
      >
        {s.text}
      </span>
    ) : (
      <span key={i} style={{ color: '#a1a1a1' }}>
        {s.text}
      </span>
    ),
  );
}

export default function OrbitalElements() {
  const [ecc, setEcc] = useState(0.2);
  const [argp, setArgp] = useState(40); // argument of perigee, degrees
  const [hovered, setHovered] = useState<Seg | null>(null);

  // Drawing geometry for the face-on orbit sketch.
  const cx = 150;
  const cy = 115;
  const aPx = 95; // semi-major axis in px
  const cPx = aPx * ecc; // focus distance from centre
  const bPx = aPx * Math.sqrt(1 - ecc * ecc);
  const rad = (argp * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  // Earth sits at the focus (fixed centre); the ellipse centre is offset toward apogee.
  const ox = cx - cPx * ux;
  const oy = cy - cPx * uy;
  const perigee = { x: ox + aPx * ux, y: oy + aPx * uy };
  const apogee = { x: ox - aPx * ux, y: oy - aPx * uy };

  return (
    <InteractiveCard
      title="Reading an orbit from its numbers"
      subtitle="Hover the highlighted TLE fields, then shape the orbit with the sliders below."
    >
      <div
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.72rem',
          lineHeight: 1.7,
          background: '#0f0f0f',
          border: '1px solid #262626',
          borderRadius: '0.6rem',
          padding: '0.7rem 0.8rem',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <div style={{ color: '#ededed', fontWeight: 700 }}>ISS (ZARYA)</div>
        <div>{renderLine(LINE1, setHovered)}</div>
        <div>{renderLine(LINE2, setHovered)}</div>
      </div>

      <div
        style={{
          minHeight: '1.4rem',
          marginTop: '0.45rem',
          fontSize: '0.82rem',
          color: hovered ? hovered.color : '#a1a1a1',
        }}
      >
        {hovered ? (
          <span>
            <strong>{hovered.label}:</strong> {hovered.text.trim()}
          </span>
        ) : (
          'Hover a coloured field to name it.'
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginTop: '0.9rem' }}>
        <svg
          viewBox="0 0 300 230"
          style={{ width: '100%', height: 'auto', maxWidth: 360, justifySelf: 'center' }}
          role="img"
          aria-label="Face-on view of an orbital ellipse with Earth at one focus"
        >
          {/* Apse line through perigee and apogee. */}
          <line
            x1={perigee.x}
            y1={perigee.y}
            x2={apogee.x}
            y2={apogee.y}
            stroke="#3f3f46"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* The orbit. */}
          <ellipse
            cx={ox}
            cy={oy}
            rx={aPx}
            ry={bPx}
            transform={`rotate(${argp} ${ox} ${oy})`}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={2}
          />
          {/* Earth at the focus. */}
          <circle cx={cx} cy={cy} r={11} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={1.5} />
          {/* Perigee & apogee markers. */}
          <circle cx={perigee.x} cy={perigee.y} r={4} fill="#34d399" />
          <circle cx={apogee.x} cy={apogee.y} r={4} fill="#f472b6" />
          <text x={perigee.x} y={perigee.y - 8} fill="#34d399" fontSize={10} textAnchor="middle">
            perigee
          </text>
          <text x={apogee.x} y={apogee.y - 8} fill="#f472b6" fontSize={10} textAnchor="middle">
            apogee
          </text>
        </svg>

        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ color: '#a1a1a1', marginBottom: '0.3rem' }}>
            Eccentricity:{' '}
            <strong style={{ color: '#f472b6' }}>{ecc.toFixed(2)}</strong>{' '}
            {ecc < 0.02 ? '(nearly circular)' : ''}
          </div>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={ecc}
            onChange={(e) => setEcc(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#f472b6', marginBottom: '0.8rem' }}
            aria-label="Eccentricity"
          />
          <div style={{ color: '#a1a1a1', marginBottom: '0.3rem' }}>
            Argument of perigee:{' '}
            <strong style={{ color: '#34d399' }}>{argp}°</strong>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={argp}
            onChange={(e) => setArgp(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#34d399' }}
            aria-label="Argument of perigee in degrees"
          />
        </div>
      </div>
    </InteractiveCard>
  );
}
