// src/components/Glass.jsx
import React, { forwardRef } from 'react';

function cx(...args){ return args.filter(Boolean).join(' '); }

export const GlassPanel = forwardRef(function GlassPanel({ className, as:Tag='div', ...rest }, ref){
  return <Tag ref={ref} className={cx('fg-panel fg-ring', className)} {...rest} />;
});
export const GlassCard = forwardRef(function GlassCard({ className, as:Tag='article', ...rest }, ref){
  return <Tag ref={ref} className={cx('fg-card fg-ring', className)} {...rest} />;
});
export const GlassPill = forwardRef(function GlassPill({ className, as:Tag='span', ...rest }, ref){
  return <Tag ref={ref} className={cx('fg-pill', className)} {...rest} />;
});
export const GlassButton = forwardRef(function GlassButton({ className, type='button', as:Tag='button', ...rest }, ref){
  return <Tag ref={ref} type={type} className={cx('fg-btn', className)} {...rest} />;
});
