import { useState } from 'react';
import { motion } from 'motion/react';
import InteractiveCard from './InteractiveCard';

/**
 * Circular orbital speed and escape speed calculator.
 *
 *   v_orbit  = sqrt(GM / r)
 *   v_escape = sqrt(2GM / r) = sqrt(2) * v_orbit
 *
 * The reader picks a body and an altitude and reads off how fast a
 * satellite must travel to stay in a circular orbit, versus how fast it
 * must go to break free entirely.
 */
const G = 6.674e-11; // m^3 kg^-1 s^-2

const BODIES = [
  { name: 'Earth', mass: 5.972e24, radius: 6.371e6 },
  { name: 'Moon', mass: 7.342e22, radius: 1.737e6 },
  { name: 'Mars', mass: 6.417e23, radius: 3.39e6 },
  { name: 'Jupiter', mass: 1.898e27, radius: 6.991e7 },
];

export default function OrbitalVelocity() {
  const [bodyIndex, setBodyIndex] = useState(0);
  const [altitudeKm, setAltitudeKm] = useState(400); // ISS-ish

  const body = BODIES[bodyIndex];
  const r = body.radius + altitudeKm * 1000;
  const vOrbit = Math.sqrt((G * body.mass) / r);
  const vEscape = Math.SQRT2 * vOrbit;

  const fmt = (v: number) => (v / 1000).toFixed(2); // km/s

  return (
    <InteractiveCard
      title="How fast must a satellite go?"
      subtitle="Circular orbit speed vs. escape speed for different worlds."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {BODIES.map((b, i) => (
          <button
            key={b.name}
            onClick={() => setBodyIndex(i)}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px solid #262626',
              background: i === bodyIndex ? '#3b82f6' : '#1f1f1f',
              color: '#ededed',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div style={{ color: '#a1a1a1', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
        Altitude above surface: <strong style={{ color: '#60a5fa' }}>{altitudeKm} km</strong>
      </div>
      <input
        type="range"
        min={100}
        max={36000}
        step={100}
        value={altitudeKm}
        onChange={(e) => setAltitudeKm(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6', marginBottom: '1.2rem' }}
        aria-label="Altitude in kilometres"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <motion.div
          key={`orbit-${fmt(vOrbit)}`}
          initial={{ scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={statBox}
        >
          <div style={statLabel}>Orbital speed</div>
          <div style={{ ...statValue, color: '#60a5fa' }}>{fmt(vOrbit)} km/s</div>
        </motion.div>
        <motion.div
          key={`escape-${fmt(vEscape)}`}
          initial={{ scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={statBox}
        >
          <div style={statLabel}>Escape speed</div>
          <div style={{ ...statValue, color: '#2dd4bf' }}>{fmt(vEscape)} km/s</div>
        </motion.div>
      </div>
    </InteractiveCard>
  );
}

const statBox: React.CSSProperties = {
  padding: '0.9rem',
  borderRadius: '0.6rem',
  background: '#0f0f0f',
  border: '1px solid #262626',
  textAlign: 'center',
};
const statLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#a1a1a1',
  marginBottom: '0.3rem',
};
const statValue: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
};
