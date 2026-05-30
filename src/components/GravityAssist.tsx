import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import InteractiveCard from './InteractiveCard';

/**
 * Gravity-assist ("slingshot") visualiser.
 *
 * In the planet's frame a flyby is elastic: the spacecraft leaves with the
 * same *speed* it arrived with, only turned by some deflection angle. But the
 * planet itself is moving around the Sun, so in the Sun's frame that turn can
 * convert into a large change in heliocentric speed — up to twice the planet's
 * orbital speed for a full reversal.
 *
 * We model a head-on approach (relative velocity opposite the planet's motion)
 * and plot the outgoing heliocentric speed as the flyby deflection angle grows
 * from 0 (a clean miss) to 180 degrees (a complete turnaround).
 */
export default function GravityAssist() {
  const [angle, setAngle] = useState(120); // deflection angle in degrees

  const U = 13; // planet's orbital speed (km/s) — roughly Jupiter
  const w = 10; // spacecraft speed relative to the planet (km/s)

  // Outgoing heliocentric speed for a head-on approach deflected by theta.
  // speed^2 = U^2 + w^2 - 2*U*w*cos(theta)
  const speedAt = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return Math.sqrt(U * U + w * w - 2 * U * w * Math.cos(t));
  };

  const data = useMemo(() => {
    const points = [];
    for (let deg = 0; deg <= 180; deg += 5) {
      points.push({ deg, speed: +speedAt(deg).toFixed(2) });
    }
    return points;
  }, []);

  const currentSpeed = +speedAt(angle).toFixed(1);
  const baseline = +speedAt(0).toFixed(1); // a straight-through, no-bend pass
  const boost = +(currentSpeed - baseline).toFixed(1);

  return (
    <InteractiveCard
      title="The slingshot: bending a path into free speed"
      subtitle="The more a planet turns your trajectory, the more of its orbital motion you keep."
    >
      <div style={{ marginBottom: '0.75rem', color: '#a1a1a1', fontSize: '0.9rem' }}>
        Deflection angle: <strong style={{ color: '#60a5fa' }}>{angle}°</strong>
        {' · '}
        Heliocentric speed:{' '}
        <strong style={{ color: '#2dd4bf' }}>{currentSpeed.toFixed(1)} km/s</strong>
        {' · '}
        Boost vs a clean miss:{' '}
        <strong style={{ color: '#fbbf24' }}>+{boost.toFixed(1)} km/s</strong>
      </div>

      <input
        type="range"
        min={0}
        max={180}
        step={5}
        value={angle}
        onChange={(e) => setAngle(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6', marginBottom: '1rem' }}
        aria-label="Flyby deflection angle in degrees"
      />

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis
              dataKey="deg"
              stroke="#a1a1a1"
              tick={{ fontSize: 12 }}
              ticks={[0, 45, 90, 135, 180]}
              label={{
                value: 'deflection angle (degrees)',
                position: 'insideBottom',
                offset: -4,
                fill: '#a1a1a1',
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="#a1a1a1"
              tick={{ fontSize: 12 }}
              domain={[0, Math.ceil(U + w)]}
              label={{
                value: 'km/s',
                angle: -90,
                position: 'insideLeft',
                offset: 16,
                fill: '#a1a1a1',
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                background: '#0f0f0f',
                border: '1px solid #1f1f1f',
                borderRadius: 8,
                color: '#ededed',
              }}
              formatter={(value: number) => [`${value.toFixed(1)} km/s`, 'speed']}
              labelFormatter={(label) => `deflection = ${label}°`}
            />
            <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <ReferenceDot x={angle} y={currentSpeed} r={6} fill="#2dd4bf" stroke="none" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </InteractiveCard>
  );
}
