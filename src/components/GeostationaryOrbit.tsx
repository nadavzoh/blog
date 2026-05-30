import { useState } from 'react';
import { motion } from 'motion/react';
import InteractiveCard from './InteractiveCard';

/**
 * Geostationary altitude finder.
 *
 * Kepler's third law fixes a one-to-one link between an orbit's size and its
 * period:  T = 2π·√(a³ / μ).  There is exactly one circular altitude where that
 * period equals Earth's *sidereal* rotation (23h 56m), so the satellite keeps
 * pace with the ground and appears to hover. The reader drags the altitude and
 * watches the period cross — and the sub-satellite point stop drifting — right
 * at ~35,786 km.
 */
const EARTH_RADIUS_KM = 6371;
const MU_KM3_S2 = 398600.4418; // Earth's gravitational parameter, km³/s²
const SIDEREAL_DAY_S = 86164.0905; // one sidereal rotation of Earth, seconds
const GEO_ALT_KM = 35786;

export default function GeostationaryOrbit() {
  const [altitudeKm, setAltitudeKm] = useState(GEO_ALT_KM);

  const a = EARTH_RADIUS_KM + altitudeKm; // semi-major axis (circular ⇒ radius)
  const periodS = 2 * Math.PI * Math.sqrt((a * a * a) / MU_KM3_S2);
  const periodH = periodS / 3600;

  // Longitude drift of the sub-satellite point, degrees per day (+ = eastward).
  const driftDegPerDay = (1 / periodS - 1 / SIDEREAL_DAY_S) * 360 * 86400;
  const holding = Math.abs(driftDegPerDay) < 1; // within ~1°/day ≈ stationary

  let verdict: { text: string; color: string };
  if (holding) {
    verdict = {
      text: 'Locked to the ground — this is geostationary. The satellite hovers over one spot.',
      color: '#f59e0b',
    };
  } else if (driftDegPerDay > 0) {
    verdict = {
      text: `Orbiting faster than Earth spins, so it drifts east at ${Math.abs(
        driftDegPerDay,
      ).toFixed(0)}°/day.`,
      color: '#60a5fa',
    };
  } else {
    verdict = {
      text: `Orbiting slower than Earth spins, so it drifts west at ${Math.abs(
        driftDegPerDay,
      ).toFixed(0)}°/day.`,
      color: '#2dd4bf',
    };
  }

  const fmtPeriod = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  return (
    <InteractiveCard
      title="Find the geostationary altitude"
      subtitle="Drag the altitude until the orbital period matches Earth's 23h 56m spin."
    >
      <div style={{ color: '#a1a1a1', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
        Altitude above surface:{' '}
        <strong style={{ color: '#f59e0b' }}>{altitudeKm.toLocaleString()} km</strong>
      </div>
      <input
        type="range"
        min={500}
        max={60000}
        step={100}
        value={altitudeKm}
        onChange={(e) => setAltitudeKm(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#f59e0b', marginBottom: '0.4rem' }}
        aria-label="Altitude in kilometres"
      />
      <button
        onClick={() => setAltitudeKm(GEO_ALT_KM)}
        style={{
          padding: '0.3rem 0.7rem',
          borderRadius: '0.5rem',
          border: '1px solid #262626',
          background: '#1f1f1f',
          color: '#ededed',
          fontSize: '0.8rem',
          cursor: 'pointer',
          marginBottom: '1.1rem',
        }}
      >
        Snap to {GEO_ALT_KM.toLocaleString()} km
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <motion.div
          key={`period-${fmtPeriod(periodH)}`}
          initial={{ scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={statBox}
        >
          <div style={statLabel}>Orbital period</div>
          <div style={{ ...statValue, color: '#f59e0b' }}>{fmtPeriod(periodH)}</div>
        </motion.div>
        <motion.div
          key={`day-${SIDEREAL_DAY_S}`}
          style={statBox}
        >
          <div style={statLabel}>Earth's spin (sidereal)</div>
          <div style={{ ...statValue, color: '#a1a1a1' }}>23h 56m</div>
        </motion.div>
      </div>

      <motion.div
        key={verdict.text}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          marginTop: '0.9rem',
          padding: '0.7rem 0.85rem',
          borderRadius: '0.6rem',
          background: '#0f0f0f',
          border: `1px solid ${verdict.color}`,
          color: '#ededed',
          fontSize: '0.88rem',
        }}
      >
        {verdict.text}
      </motion.div>
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
