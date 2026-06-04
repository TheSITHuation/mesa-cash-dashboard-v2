import React, { useState, useEffect } from 'react';

export const PromoBanner = React.memo(function PromoBanner({ promotions }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % promotions.length);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, [promotions.length]);

  if (!promotions.length) return null;
  const p = promotions[Math.min(idx, promotions.length - 1)];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto 12px', padding: '0 16px', position: 'relative', zIndex: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: p.priority > 0
          ? 'linear-gradient(135deg, rgba(212,175,55,.15), rgba(212,175,55,.06))'
          : 'rgba(255,255,255,.05)',
        border: p.priority > 0 ? '1px solid rgba(212,175,55,.3)' : '1px solid rgba(255,255,255,.1)',
        borderRadius: 14, padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        transition: 'opacity .3s ease', opacity: visible ? 1 : 0,
        boxShadow: '0 8px 24px rgba(0,0,0,.3)'
      }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{p.emoji || '📢'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.priority > 0 ? '#d4af37' : '#fff', marginBottom: 2 }}>
            {p.title}
          </div>
          {p.body && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.body}
            </div>
          )}
        </div>
        {promotions.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {promotions.map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === idx ? '#d4af37' : 'rgba(255,255,255,.2)',
                transition: 'background .3s',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
