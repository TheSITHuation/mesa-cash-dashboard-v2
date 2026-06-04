// src/pages/td3-bridge.js
import './td3-bridge.scss';
import { writeTd3ToFirestore, resetTd3Doc } from '../services/td3/publisher.js';
import { db } from '../services/config/firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { showStructureUpload } from '../ui/td3-structure-upload.js';
import { showStructureViewer, highlightCurrentRound } from '../ui/td3-structure-viewer.js';

const qs = (s, r = document) => r.querySelector(s);

async function requireStaff() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, 'roles', user.uid));
    return snap.exists() && String(snap.data()?.role || '').toLowerCase() === 'staff';
  } catch { return false; }
}

function parseMaybeJson(text) {
  if (!text || !text.trim()) return null;
  
  let obj = {};
  try { obj = JSON.parse(text); } catch {
    // 1. Intento de etiquetas XML <tag>valor</tag>
    const xmlMatches = text.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);
    for (const m of xmlMatches) {
      obj[m[1]] = m[2].trim();
    }

    // 2. Intento de clave: valor o clave = valor (multilínea)
    text.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([\w-]+)\s*[:=]\s*(.+?)\s*$/);
      if (m && !obj[m[1]]) obj[m[1]] = m[2].trim();
    });

    // 3. Búsqueda agresiva de palabras clave o códigos cortos discretos
    if (!obj.nextBreak) {
      // Busca "|nb|20:00" o "nextBreak: 20:00"
      const nbMatch = text.match(/(?:nextBreak|\|nb\||Próximo Descanso|Descanso)\s*[:=]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
      if (nbMatch) obj.nextBreak = nbMatch[1];
    }
    if (!obj.prizes) {
      // Busca "|pr|lista..." o "prizes: lista..."
      const pzMatch = text.match(/(?:prizes|\|pr\||premios|payouts)\s*[:=]?\s*(.+)/i);
      if (pzMatch) obj.prizes = pzMatch[1].trim();
    }
  }

  return Object.keys(obj).length ? obj : null;
}

export function renderTd3Bridge() {
  const app = document.getElementById('app') || document.body;
  app.innerHTML = `
    <div class="lobby" style="padding:16px 16px 80px">
      <header class="lobby-hero">
        <div class="lobby-hero__glass glass-panel">
          <h1 class="wordmark"><span class="wm-sk">Bridge</span> <span class="wm-po">TD3</span></h1>
        </div>
      </header>

      <section class="glass-card" style="padding:16px; margin-top:12px">
        <div id="staff-guard" class="muted" style="margin-bottom:12px">Verificando permisos…</div>

        <div style="display:grid; gap:12px; grid-template-columns: 1fr; max-width:1000px">
          <textarea id="td3-input" rows="14" placeholder='Pega aquí el JSON crudo del TTD3 (o usa "Ejemplo")' class="tm-input" style="width:100%;"></textarea>

          <div style="display:flex; gap:8px; flex-wrap:wrap">
            <button id="btn-publish" class="btn glass-btn">Publicar</button>
            <button id="btn-example" class="btn glass-btn btn-ghost">Ejemplo</button>
            <button id="btn-reset" class="btn glass-btn danger">Reset doc</button>
            <button id="btn-upload-structure" class="btn glass-btn btn-ghost">📋 Subir Estructura</button>
          </div>

          <div class="muted" id="status">—</div>
          
          <div id="break-countdown" style="display:none; background:rgba(255,159,10,0.1); border:1px solid rgba(255,159,10,0.3); border-radius:12px; padding:16px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:12px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.5px;">Próximo Descanso</div>
                <div id="break-label" style="font-size:18px; font-weight:700; color:#ff9f0a; margin-top:4px;">-</div>
              </div>
              <div style="text-align:right;">
                <div id="break-timer" style="font-size:32px; font-weight:700; font-family:monospace; color:#ff9f0a;">--:--</div>
                <div id="break-rounds" style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:4px;">-</div>
              </div>
            </div>
          </div>
          
          <div id="structure-viewer-container"></div>
          
          <pre class="glass-card" id="doc-view" style="padding:12px; overflow:auto; max-height:260px"></pre>
        </div>
      </section>
    </div>
  `;

  const $guard = qs('#staff-guard', app);
  const $input = qs('#td3-input', app);
  const $status = qs('#status', app);
  const $view = qs('#doc-view', app);

  // Live view del doc
  onSnapshot(doc(db, 'td3', 'currentTournament'), (snap) => {
    $view.textContent = snap.exists()
      ? JSON.stringify(snap.data(), null, 2)
      : '(documento vacío)';
  });

  // Auth guard (solo staff)
  const auth = getAuth();
  onAuthStateChanged(auth, async (u) => {
    if (!u) { $guard.textContent = 'Inicia sesión para publicar.'; return; }
    const ok = await requireStaff();
    $guard.textContent = ok ? `Permisos OK (staff: ${u.email || u.uid})` :
      'No tienes rol de staff (contacta al admin).';
    // Bloquea UI si no es staff
    const disabled = !ok;
    ['btn-publish', 'btn-example', 'btn-reset', 'td3-input'].forEach(id => {
      const el = qs('#' + id, app);
      if (el) el.disabled = disabled;
    });
  });

  // Acciones
  qs('#btn-example', app).onclick = () => {
    $input.value = JSON.stringify({
      Title: 'Torneo Skampa Premium',
      RoundNum: 1,
      SmallBlind: 100, BigBlind: 200, Ante: 0,
      NextSmallBlind: 200, NextBigBlind: 400, NextAnte: 25,
      PlayersLeft: 15, Buyins: 30, TotalRebuys: 5, TotalAddons: 2,
      ChipCount: 300000, Pot: 20000,
      SecondsLeft: 900, // 15:00
      SecondsElapsed: 600,
      IsBreak: 0, NextIsBreak: 0,
      NextBreak: "45:00", // 45:00 para el próximo descanso
      addonTimeLeft: "1:30:00", // 1 hora 30 min para fin de registro
      prizes: "1º $5,000 | 2º $3,000 | 3º $2,000",
      Currency: 'MXN', StateDesc: 'inprogress'
    }, null, 2);
  };

  qs('#btn-publish', app).onclick = async () => {
    const data = parseMaybeJson($input.value);
    if (!data) { alert('No pude leer el JSON/clave=valor.'); return; }
    try {
      $status.textContent = 'Publicando…';
      await writeTd3ToFirestore(data);
      $status.textContent = 'OK: publicado.';
    } catch (e) {
      console.error(e);
      $status.textContent = 'Error al publicar.';
      alert('Error al publicar en Firestore (revisa permisos de staff y reglas).');
    }
  };

  qs('#btn-reset', app).onclick = async () => {
    if (!confirm('¿Resetear el documento td3/currentTournament?')) return;
    try { await resetTd3Doc(); $status.textContent = 'Doc reseteado.'; }
    catch (e) { console.error(e); alert('No se pudo resetear.'); }
  };

  qs('#btn-upload-structure', app).onclick = () => {
    showStructureUpload();
  };

  // Break countdown
  const $breakCountdown = qs('#break-countdown', app);
  const $breakLabel = qs('#break-label', app);
  const $breakTimer = qs('#break-timer', app);
  const $breakRounds = qs('#break-rounds', app);
  let breakTimerInterval = null;

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function updateBreakCountdown(data) {
    if (!data || !data.secondsUntilBreak || data.secondsUntilBreak <= 0) {
      if ($breakCountdown) $breakCountdown.style.display = 'none';
      if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
      }
      return;
    }

    if ($breakCountdown) $breakCountdown.style.display = 'block';
    if ($breakLabel) $breakLabel.textContent = data.nextBreakLabel || 'Descanso';
    if ($breakRounds) {
      const rounds = data.roundsUntilBreak || 0;
      $breakRounds.textContent = rounds > 0 ? `${rounds} nivel${rounds > 1 ? 'es' : ''} restante${rounds > 1 ? 's' : ''}` : 'Siguiente nivel';
    }

    let remaining = data.secondsUntilBreak;
    
    function tick() {
      if ($breakTimer) $breakTimer.textContent = formatTime(remaining);
      if (remaining > 0) remaining--;
      else {
        if (breakTimerInterval) clearInterval(breakTimerInterval);
        breakTimerInterval = null;
      }
    }
    
    tick();
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    breakTimerInterval = setInterval(tick, 1000);
  }

  // Live view del doc con break countdown
  onSnapshot(doc(db, 'td3', 'currentTournament'), (snap) => {
    const data = snap.exists() ? snap.data() : null;
    $view.textContent = data ? JSON.stringify(data, null, 2) : '(documento vacío)';
    updateBreakCountdown(data);
    
    // Highlight current round in structure viewer
    if (data && data.level) {
      const viewerContainer = qs('#structure-viewer-container', app);
      if (viewerContainer) {
        highlightCurrentRound(viewerContainer, data.level);
      }
    }
  });

  // Load structure viewer
  const viewerContainer = qs('#structure-viewer-container', app);
  if (viewerContainer) {
    showStructureViewer(viewerContainer);
  }
}
