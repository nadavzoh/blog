import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface InteractiveCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * A consistent, animated frame used to wrap every interactive island.
 * Fades/slides in when scrolled into view so embeds feel alive.
 */
export default function InteractiveCard({ title, subtitle, children }: InteractiveCardProps) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
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
