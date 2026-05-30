import { useState } from 'react';
import {
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import InteractiveCard from './InteractiveCard';

/**
 * Kepler's Third Law: T^2 ∝ a^3.
 *
 * For planets orbiting the Sun, if we measure the orbital period T in years
 * and the semi-major axis a in astronomical units (AU), then T^2 = a^3
 * exactly. The reader can toggle between the raw curve and the linearised
 * log-log view where the law becomes a perfectly straight line.
 */
const PLANETS = [
  { name: 'Mercury', a: 0.387, T: 0.241 },
  { name: 'Venus', a: 0.723, T: 0.615 },
  { name: 'Earth', a: 1.0, T: 1.0 },
  { name: 'Mars', a: 1.524, T: 1.881 },
  { name: 'Jupiter', a: 5.203, T: 11.862 },
  { name: 'Saturn', a: 9.537, T: 29.457 },
  { name: 'Uranus', a: 19.191, T: 84.011 },
  { name: 'Neptune', a: 30.069, T: 164.79 },
];

export default function KeplerThirdLaw() {
  const [logScale, setLogScale] = useState(false);

  const scatterData = PLANETS.map((p) => ({
    ...p,
    x: logScale ? Math.log10(p.a) : p.a,
    y: logScale ? Math.log10(p.T) : p.T,
  }));

  // The predicted line T = a^(3/2), sampled for the overlay.
  const lineData = [] as { x: number; y: number }[];
  for (let a = 0.3; a <= 31; a *= 1.15) {
    const T = Math.pow(a, 1.5);
    lineData.push({
      x: logScale ? Math.log10(a) : a,
      y: logScale ? Math.log10(T) : T,
    });
  }

  return (
    <InteractiveCard
      title="Kepler's Third Law for the Solar System"
      subtitle="Every planet obeys T² = a³. Switch to log–log to see it snap into a straight line."
    >
      <button
        onClick={() => setLogScale((v) => !v)}
        style={{
          padding: '0.4rem 0.9rem',
          borderRadius: '0.5rem',
          border: '1px solid #262626',
          background: logScale ? '#3b82f6' : '#1f1f1f',
          color: '#ededed',
          fontSize: '0.85rem',
          cursor: 'pointer',
          marginBottom: '0.9rem',
        }}
      >
        {logScale ? 'Log–log scale ✓' : 'Linear scale'}
      </button>

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart
            data={lineData}
            margin={{ top: 8, right: 16, bottom: 16, left: -4 }}
          >
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              stroke="#a1a1a1"
              tick={{ fontSize: 12 }}
              domain={['auto', 'auto']}
              label={{
                value: logScale ? 'log₁₀(a / AU)' : 'a — semi-major axis (AU)',
                position: 'insideBottom',
                offset: -8,
                fill: '#a1a1a1',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              stroke="#a1a1a1"
              tick={{ fontSize: 12 }}
              domain={['auto', 'auto']}
              label={{
                value: logScale ? 'log₁₀(T / yr)' : 'T — period (yr)',
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
              formatter={(value: number, name: string) => [value.toFixed(3), name]}
            />
            <Line
              type="monotone"
              dataKey="y"
              data={lineData}
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={false}
              name="T = a^1.5"
              isAnimationActive={false}
            />
            <Scatter
              data={scatterData}
              dataKey="y"
              fill="#60a5fa"
              name="planets"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#a1a1a1' }}>
        Dots are the eight planets; the teal curve is the prediction T = a<sup>3/2</sup>.
      </p>
    </InteractiveCard>
  );
}
