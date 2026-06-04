// src/components/ui/TabSwitcher.jsx
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const contentVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 30,
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: 'easeIn',
    },
  }),
};

const indicatorVariants = {
  initial: { width: 0 },
  animate: (width) => ({
    width,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 35,
    },
  }),
};

const listItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      type: 'spring',
      stiffness: 300,
      damping: 26,
    },
  }),
};

export default function TabSwitcher({
  tabs,
  activeTab,
  onTabChange,
  renderContent,
  className = '',
}) {
  const [direction, setDirection] = useState(1);
  const tabRefs = useRef({});

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;

    const oldIndex = tabs.findIndex((t) => t.id === activeTab);
    const newIndex = tabs.findIndex((t) => t.id === newTab);

    setDirection(newIndex > oldIndex ? 1 : -1);
    onTabChange(newTab);
  };

  return (
    <div className={`tab-switcher ${className}`}>
      <div className="tab-switcher-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const ref = tabRefs.current[tab.id];

          return (
            <motion.button
              key={tab.id}
              className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              whileTap={{ scale: 0.96 }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && ref && (
                <motion.span
                  className="tab-indicator"
                  layoutId="tab-indicator"
                  variants={indicatorVariants}
                  initial="initial"
                  animate="animate"
                  custom={ref.offsetWidth}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="tab-switcher-content">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            className="tab-content-panel"
            custom={direction}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderContent(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function TabListItem({ children, index }) {
  return (
    <motion.div
      className="tab-list-item"
      custom={index}
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
