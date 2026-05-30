import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import InteractiveCard from './InteractiveCard';

export interface ChartPoint {
  x: number | string;
  y: number;
}

interface ExampleChartProps {
  title?: string;
  subtitle?: string;
  data?: ChartPoint[];
}

const DEFAULT_DATA: ChartPoint[] = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 8 },
  { x: 4, y: 16 },
  { x: 5, y: 32 },
  { x: 6, y: 64 },
];

/**
 * A small, domain-neutral charting island used to demonstrate that interactive
 * Recharts visualizations still embed cleanly inside MDX articles.
 */
export default function ExampleChart({
  title = 'Example chart',
  subtitle = 'A Recharts line chart embedded as a hydrated React island.',
  data = DEFAULT_DATA,
}: ExampleChartProps) {
  return (
    <InteractiveCard title={title} subtitle={subtitle}>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
            <XAxis dataKey="x" stroke="#a1a1a1" />
            <YAxis stroke="#a1a1a1" />
            <Tooltip
              contentStyle={{
                background: '#111',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#ededed',
              }}
            />
            <Line type="monotone" dataKey="y" stroke="#5b8cff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </InteractiveCard>
  );
}
