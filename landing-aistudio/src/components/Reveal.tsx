import React from 'react';
import { motion } from 'motion/react';

// Fades a section up as it scrolls into view. Honors reduced motion via MotionConfig in main.tsx.
export const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1], delay }}
  >
    {children}
  </motion.div>
);
