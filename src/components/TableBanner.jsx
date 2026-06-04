import React from 'react';
import './table-banner/table-banner.scss'; // estilos del banner

const statusLabel = (s = '') => {
  const v = String(s).toLowerCase();
  if (v === 'en-espera') return 'en espera';
  if (v === 'inactive')  return 'inactiva';
  if (v === 'active')    return 'activa';
  return v || 'inactiva';
};

export default function TableBanner({
  title = 'VIP Cash',
  status = 'inactive',                   // 'active' | 'inactive' | 'en-espera'
  onViewPlayers = () => {},
  onClose = () => {},
  className = ''
}) {
  return (
    <div className={`table-banner fg-panel fg-ring ${className}`}>
      <h3 className="glass-title">{title}</h3>

      <div className="meta">
        <span className="badge fg-pill" data-status={String(status).toLowerCase()}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn fg-btn" onClick={onViewPlayers}>
          Ver Jugadores
        </button>
        <button type="button" className="btn glass-btn glass-btn--danger" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
