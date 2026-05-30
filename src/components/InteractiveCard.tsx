import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

interface InteractiveCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * A consistent, animated frame used to wrap every interactive island.
 *
 * The islands hydrate with `client:visible`, so they are already on screen by
 * the time React takes over. We gate the entrance animation behind a `mounted`
 * flag so the server-rendered markup and the first client render are identical
 * (no hydration mismatch), then play the fade/slide-in on mount.
 */
export default function InteractiveCard({ title, subtitle, children }: InteractiveCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.figure
      initial={false}
      animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 24 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        margin: '2rem 0',
        padding: '1.25rem',
        borderRadius: '1rem',
        border: '1px solid #111634',
        background: 'linear-gradient(180deg, rgba(17,22,52,0.7), rgba(10,15,36,0.7))',
        boxShadow: '0 10px 40px -20px rgba(108,124,255,0.45)',
      }}
    >
      <figcaption style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#e7ecff' }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: '0.85rem', color: '#aab4d4', marginTop: '0.2rem' }}>
            {subtitle}
          </div>
        ) : null}
      </figcaption>
      {children}
    </motion.figure>
  );
}
