// src/components/ui/StaggerList.jsx
import { motion } from 'framer-motion';
import { Children, isValidElement, cloneElement } from 'react';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export default function StaggerList({
  children,
  delay = 0.06,
  stagger = true,
  className = '',
  as = 'div',
  itemClassName = '',
}) {
  if (!stagger) {
    return <div className={className}>{children}</div>;
  }

  const childrenArray = Children.toArray(children);

  return (
    <motion.div
      className={`stagger-list ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ '--stagger-delay': `${delay}s` }}
    >
      {childrenArray.map((child, index) => {
        if (!isValidElement(child)) return child;

        const staggerDelay = delay * index;

        return (
          <motion.div
            key={child.key ?? index}
            className={`stagger-item ${itemClassName}`}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            custom={index}
            style={{
              transitionDelay: `${staggerDelay}s`,
            }}
          >
            {cloneElement(child, {
              style: {
                ...child.props.style,
                animationDelay: `${staggerDelay * 1000}ms`,
              },
            })}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function useStaggerAnimation(count, baseDelay = 0.05) {
  return Array.from({ length: count }, (_, i) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
      delay: i * baseDelay,
    },
  }));
}
