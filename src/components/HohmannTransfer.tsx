import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import InteractiveCard from './InteractiveCard';

/**
 * Hohmann transfer orbit visualiser.
 *
 * The cheapest way to move between two circular orbits is half of an
 * ellipse that just kisses the inner orbit at one end and the outer orbit
 * at the other. Two engine burns: one to leave, one to arrive.
 */
export default function HohmannTransfer() {
  const [outerR, setOuterR] = useState(150);
  const innerR = 70;
  const cx = 200;
  const cy = 160;

  // Ellipse geometry: semi-major axis is the average of the two radii.
  const a = (innerR + outerR) / 2;
  const c = a - innerR; // focus offset from ellipse centre
  const b = Math.sqrt(Math.max(a * a - c * c, 1)); // semi-minor axis
  // The ellipse is centred along the x-axis, offset so one focus sits on the planet.
  const ellipseCx = cx - c;

  // Animate a spacecraft along the transfer ellipse (half loop).
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => (prev + dt * 0.25) % 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // Parametrise the half-ellipse from periapsis (inner) to apoapsis (outer).
  const theta = Math.PI * t; // 0 -> PI sweeps the upper half
  const craftX = ellipseCx + a * Math.cos(theta);
  const craftY = cy - b * Math.sin(theta);

  // Delta-v figures (relative, schematic) just to make the idea concrete.
  const ratio = outerR / innerR;
  const dv1 = (Math.sqrt((2 * ratio) / (1 + ratio)) - 1).toFixed(2);
  const dv2 = (1 - Math.sqrt(2 / (1 + ratio)) / Math.sqrt(ratio)).toFixed(2);

  return (
    <InteractiveCard
      title="Hohmann transfer orbit"
      subtitle="Two burns and a half-ellipse take you from a low orbit to a high one."
    >
      <svg
        viewBox="0 0 400 320"
        style={{ width: '100%', height: 'auto', background: '#0a0a0a', borderRadius: '0.75rem' }}
      >
        {/* inner (start) orbit */}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
        {/* outer (target) orbit */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {/* transfer ellipse */}
        <ellipse
          cx={ellipseCx}
          cy={cy}
          rx={a}
          ry={b}
          fill="none"
          stroke="#ededed"
          strokeWidth={1.5}
          strokeDasharray="2 5"
        />
        {/* planet at the focus */}
        <circle cx={cx} cy={cy} r={10} fill="#60a5fa" />

        {/* burn markers */}
        <circle cx={cx + innerR} cy={cy} r={4} fill="#fbbf24" />
        <text x={cx + innerR + 6} y={cy + 4} fill="#fbbf24" fontSize={10}>
          burn 1
        </text>
        <circle cx={cx - outerR} cy={cy} r={4} fill="#fbbf24" />
        <text x={cx - outerR - 44} y={cy + 4} fill="#fbbf24" fontSize={10}>
          burn 2
        </text>

        {/* spacecraft */}
        <motion.circle cx={craftX} cy={craftY} r={5} fill="#2dd4bf" />
      </svg>

      <div style={{ marginTop: '0.9rem', color: '#a1a1a1', fontSize: '0.9rem' }}>
        Target orbit radius:{' '}
        <strong style={{ color: '#60a5fa' }}>{(outerR / innerR).toFixed(2)}×</strong> the starting
        orbit
      </div>
      <input
        type="range"
        min={90}
        max={150}
        step={1}
        value={outerR}
        onChange={(e) => setOuterR(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#14b8a6', marginTop: '0.4rem' }}
        aria-label="Target orbit radius"
      />

      <div
        style={{
          marginTop: '0.8rem',
          display: 'flex',
          gap: '1.5rem',
          fontSize: '0.85rem',
          color: '#a1a1a1',
        }}
      >
        <span>
          Burn 1 (speed up): <strong style={{ color: '#fbbf24' }}>+{dv1}</strong>
        </span>
        <span>
          Burn 2 (circularise): <strong style={{ color: '#fbbf24' }}>+{dv2}</strong>
        </span>
      </div>
    </InteractiveCard>
  );
}
