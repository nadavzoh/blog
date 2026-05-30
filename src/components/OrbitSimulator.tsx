import { useEffect, useRef, useState } from 'react';
import InteractiveCard from './InteractiveCard';

/**
 * Newton's cannonball thought experiment.
 *
 * Fire a projectile horizontally from a tall mountain. Too slow and it
 * crashes back down; just right and it falls *around* the planet forever —
 * that is an orbit. Too fast and it escapes. We integrate simple Newtonian
 * gravity with a basic symplectic (Euler-Cromer) step.
 */
export default function OrbitSimulator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speed, setSpeed] = useState(5.6); // launch speed in arbitrary units
  const [running, setRunning] = useState(true);
  const speedRef = useRef(speed);
  const runningRef = useRef(running);
  const resetTokenRef = useRef(0);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // Re-launch whenever the speed slider changes.
  function relaunch() {
    resetTokenRef.current += 1;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const planetR = 46; // planet radius in px
    const GM = 9000; // gravitational parameter (tuned for the canvas)

    let token = -1;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let crashed = false;
    let escaped = false;
    const trail: { x: number; y: number }[] = [];

    function launch() {
      token = resetTokenRef.current;
      // Start just above the planet's "north pole".
      x = cx;
      y = cy - (planetR + 14);
      vx = speedRef.current * 10; // horizontal launch
      vy = 0;
      crashed = false;
      escaped = false;
      trail.length = 0;
    }
    launch();

    let raf = 0;
    const step = () => {
      if (token !== resetTokenRef.current) launch();

      if (runningRef.current && !crashed && !escaped) {
        const sub = 4; // sub-steps per frame for stability
        for (let i = 0; i < sub; i++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.hypot(dx, dy);
          const a = -GM / (r * r);
          const ax = (a * dx) / r;
          const ay = (a * dy) / r;
          vx += ax * 0.016;
          vy += ay * 0.016;
          x += vx * 0.016;
          y += vy * 0.016;
          if (r <= planetR + 1) crashed = true;
          if (r > Math.max(W, H)) escaped = true;
        }
        trail.push({ x, y });
        if (trail.length > 600) trail.shift();
      }

      // --- draw ---
      ctx.clearRect(0, 0, W, H);

      // starfield
      ctx.fillStyle = 'rgba(231,236,255,0.35)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % W;
        const sy = (i * 53) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // trail
      ctx.beginPath();
      trail.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = 'rgba(79,209,197,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // planet
      const grad = ctx.createRadialGradient(cx - 12, cy - 12, 6, cx, cy, planetR);
      grad.addColorStop(0, '#6c7cff');
      grad.addColorStop(1, '#111634');
      ctx.beginPath();
      ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // projectile
      if (!crashed) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e7ecff';
        ctx.fill();
      }

      // status text
      ctx.fillStyle = '#aab4d4';
      ctx.font = '13px system-ui, sans-serif';
      const label = crashed
        ? '💥 Too slow — it crashed back down.'
        : escaped
          ? '🚀 Too fast — it escaped into deep space.'
          : '🛰️ Stable-ish orbit — falling around the planet.';
      ctx.fillText(label, 12, H - 14);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <InteractiveCard
      title="Newton's cannonball"
      subtitle="An orbit is just falling sideways fast enough to keep missing the ground."
    >
      <canvas
        ref={canvasRef}
        width={520}
        height={340}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '0.75rem',
          background: '#050714',
          display: 'block',
        }}
      />

      <div style={{ marginTop: '0.9rem', color: '#aab4d4', fontSize: '0.9rem' }}>
        Launch speed: <strong style={{ color: '#8b9dff' }}>{speed.toFixed(1)}</strong> units
      </div>
      <input
        type="range"
        min={3}
        max={9}
        step={0.1}
        value={speed}
        onChange={(e) => {
          setSpeed(parseFloat(e.target.value));
          relaunch();
        }}
        style={{ width: '100%', accentColor: '#6c7cff', marginTop: '0.4rem' }}
        aria-label="Launch speed"
      />

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem' }}>
        <button
          onClick={() => setRunning((r) => !r)}
          style={btnStyle}
        >
          {running ? 'Pause' : 'Play'}
        </button>
        <button onClick={relaunch} style={btnStyle}>
          Re-launch
        </button>
      </div>
    </InteractiveCard>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  borderRadius: '0.5rem',
  border: '1px solid #1b2147',
  background: '#111634',
  color: '#e7ecff',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
