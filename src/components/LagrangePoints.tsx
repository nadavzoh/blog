import { useState } from 'react';
import InteractiveCard from './InteractiveCard';

/**
 * Lagrange points visualiser.
 *
 * In a two-body system (a big primary like the Sun and a smaller secondary
 * like a planet) there are five points where a lightweight third object can
 * sit in a fixed configuration that rotates along with the pair.
 *
 * - L4 and L5 sit at the corners of the two equilateral triangles formed with
 *   the two bodies (60 degrees ahead of and behind the secondary) — these are
 *   the stable ones, where Trojan asteroids collect.
 * - L1, L2 and L3 lie along the line through both bodies. Their offsets follow
 *   the usual small-mass-ratio approximations, with r_hill = R*(mu/3)^(1/3).
 */
export default function LagrangePoints() {
  // Secondary-to-total mass ratio mu = m2 / (m1 + m2). Exaggerated for clarity.
  const [mu, setMu] = useState(0.08);

  const cx = 150; // primary (Sun) x in SVG space
  const cy = 160;
  const R = 150; // primary-secondary separation in pixels

  const planetX = cx + R;

  // Collinear point offsets (textbook approximations).
  const rHill = R * Math.cbrt(mu / 3);
  const l1X = planetX - rHill;
  const l2X = planetX + rHill;
  const l3X = cx - R * (1 + (5 * mu) / 12);

  // Triangular points: equilateral triangle with both bodies, 60 deg off-axis.
  const l4X = cx + R / 2;
  const l4Y = cy - (R * Math.sqrt(3)) / 2;
  const l5Y = cy + (R * Math.sqrt(3)) / 2;

  const pointStyle = { fill: '#fbbf24', stroke: 'none' } as const;
  const labelStyle = { fill: '#fbbf24', fontSize: 11 } as const;

  return (
    <InteractiveCard
      title="The five parking spots of a two-body system"
      subtitle="Five points where gravity and orbital motion balance so a craft holds station."
    >
      <svg
        viewBox="0 0 420 320"
        style={{ width: '100%', height: 'auto', background: '#0a0a0a', borderRadius: '0.75rem' }}
      >
        {/* secondary's orbit around the primary */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#262626" strokeWidth={1.5} />

        {/* line joining the two bodies (the collinear axis) */}
        <line x1={l3X} y1={cy} x2={l2X} y2={cy} stroke="#1f1f1f" strokeWidth={1} />

        {/* primary and secondary */}
        <circle cx={cx} cy={cy} r={11} fill="#60a5fa" />
        <text x={cx} y={cy + 26} fill="#a1a1a1" fontSize={11} textAnchor="middle">
          primary
        </text>
        <circle cx={planetX} cy={cy} r={6} fill="#2dd4bf" />
        <text x={planetX} y={cy + 22} fill="#a1a1a1" fontSize={11} textAnchor="middle">
          secondary
        </text>

        {/* collinear points L1, L2, L3 */}
        <circle cx={l1X} cy={cy} r={4} {...pointStyle} />
        <text x={l1X} y={cy - 9} {...labelStyle} textAnchor="middle">
          L1
        </text>
        <circle cx={l2X} cy={cy} r={4} {...pointStyle} />
        <text x={l2X} y={cy - 9} {...labelStyle} textAnchor="middle">
          L2
        </text>
        <circle cx={l3X} cy={cy} r={4} {...pointStyle} />
        <text x={l3X} y={cy - 9} {...labelStyle} textAnchor="middle">
          L3
        </text>

        {/* triangular points L4 (leading) and L5 (trailing) */}
        <circle cx={l4X} cy={l4Y} r={4} {...pointStyle} />
        <text x={l4X + 8} y={l4Y + 4} {...labelStyle}>
          L4
        </text>
        <circle cx={l4X} cy={l5Y} r={4} {...pointStyle} />
        <text x={l4X + 8} y={l5Y + 4} {...labelStyle}>
          L5
        </text>
      </svg>

      <div style={{ marginTop: '0.9rem', color: '#a1a1a1', fontSize: '0.9rem' }}>
        Mass ratio{' '}
        <strong style={{ color: '#60a5fa' }}>
          μ = {mu.toFixed(3)}
        </strong>{' '}
        — how heavy the secondary is compared with the whole system.
      </div>
      <input
        type="range"
        min={0.005}
        max={0.2}
        step={0.005}
        value={mu}
        onChange={(e) => setMu(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#14b8a6', marginTop: '0.4rem' }}
        aria-label="Secondary-to-total mass ratio"
      />
      <div style={{ marginTop: '0.6rem', color: '#a1a1a1', fontSize: '0.85rem' }}>
        Heavier secondary → L1 and L2 push farther out from it, while L4 and L5
        stay locked at the 60° corners no matter what.
      </div>
    </InteractiveCard>
  );
}
