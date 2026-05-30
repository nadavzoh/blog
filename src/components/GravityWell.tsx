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
 * Visualises Newton's law of universal gravitation: F = G * m1 * m2 / r^2.
 * The reader drags the distance slider and watches the inverse-square
 * falloff of gravitational force.
 */
export default function GravityWell() {
  const [distance, setDistance] = useState(2); // in Earth radii

  // Force relative to the value at the surface (r = 1 Earth radius).
  const data = useMemo(() => {
    const points = [];
    for (let r = 1; r <= 10; r += 0.25) {
      points.push({ r, force: +(1 / (r * r)).toFixed(4) });
    }
    return points;
  }, []);

  const currentForce = +(1 / (distance * distance)).toFixed(3);

  return (
    <InteractiveCard
      title="The inverse-square law of gravity"
      subtitle="Move away from Earth and gravity weakens — fast."
    >
      <div style={{ marginBottom: '0.75rem', color: '#aab4d4', fontSize: '0.9rem' }}>
        Distance from Earth's centre:{' '}
        <strong style={{ color: '#8b9dff' }}>{distance.toFixed(2)} Earth radii</strong>
        {' · '}
        Gravity felt:{' '}
        <strong style={{ color: '#4fd1c5' }}>{(currentForce * 100).toFixed(1)}%</strong> of
        surface
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={0.25}
        value={distance}
        onChange={(e) => setDistance(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#6c7cff', marginBottom: '1rem' }}
        aria-label="Distance from Earth in Earth radii"
      />

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid stroke="#1b2147" strokeDasharray="3 3" />
            <XAxis
              dataKey="r"
              stroke="#aab4d4"
              tick={{ fontSize: 12 }}
              label={{
                value: 'distance (Earth radii)',
                position: 'insideBottom',
                offset: -4,
                fill: '#aab4d4',
                fontSize: 11,
              }}
            />
            <YAxis stroke="#aab4d4" tick={{ fontSize: 12 }} domain={[0, 1]} />
            <Tooltip
              contentStyle={{
                background: '#0a0f24',
                border: '1px solid #111634',
                borderRadius: 8,
                color: '#e7ecff',
              }}
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'gravity']}
              labelFormatter={(label) => `r = ${label} Earth radii`}
            />
            <Line
              type="monotone"
              dataKey="force"
              stroke="#6c7cff"
              strokeWidth={2.5}
              dot={false}
            />
            <ReferenceDot x={distance} y={currentForce} r={6} fill="#4fd1c5" stroke="none" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </InteractiveCard>
  );
}
