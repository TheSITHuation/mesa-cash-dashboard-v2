// functions/index.js  (Node 20, Firebase Functions v2)
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: ['https://poker-room-2.web.app', 'http://localhost:5173', 'https://poker-room-2.firebaseapp.com'] });

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TD3_API_KEY = defineSecret('TD3_API_KEY');

/* ───────────── helpers ───────────── */
const num = (v, d = 0) => {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const txt = (v, d = '') => (v === null || v === undefined) ? d : String(v);
const firstNum = (...vals) => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};
const normalizeState = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n === 2) return 'inprogress';
    if (n === 4) return 'complete';
    if (n === 3) return 'paused';
    if (n === 1) return 'waiting';
    return s;
  }
  if (s === 'in progress' || s === 'in_progress') return 'inprogress';
  return s;
};

function sanitizeId(id) {
  if (!id) return null;
  if (id.includes('/') || id.includes('..')) return null;
  return id;
}

/** Intenta extraer un "Nivel N" de campos de texto. Devuelve entero o null. */
function parseVisibleLevelFromText(body) {
  const candidates = [
    body.Title, body.title,
    body.EventName, body.eventName,
    body.Clock, body.clock, body.ClockText, body.clockText,
    body.StateDesc, body.stateDesc, body.state
  ].filter(Boolean).map(String);

  const re = /\b(?:nivel|level|lvl|lv)\s*[:\-]?\s*(\d{1,3})\b/i;
  for (const s of candidates) {
    const m = s.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Obtiene el nivel del torneo desde el payload de TD3.
 *
 * Reglas (en orden de prioridad):
 *  1) RoundNum         → usarlo directo (es el nivel real que avanza en TD3).
 *  2) Level explícito  → fallback si no hay RoundNum.
 *  3) Override textual → solo si no hay Level/RoundNum.
 *  4) Sin dato         → mantener nivel previo.
 */
function pickLevelSmart({ body, prev, sbIn, bbIn, anteIn }) {
  const prevLevel = (prev && Number.isFinite(Number(prev.level))) ? Number(prev.level) : 0;
  const prevSB    = prev ? Number(prev.smallBlind || 0) : 0;
  const prevBB    = prev ? Number(prev.bigBlind   || 0) : 0;
  const prevAnte  = prev ? Number(prev.ante       || 0) : 0;
  const blindsWentDown = (sbIn < prevSB) || (bbIn < prevBB) || (anteIn < prevAnte);

  // 1) RoundNum — TD3 lo envía en base-1 y siempre avanza correctamente
  const R = Number(body.RoundNum ?? body.round);
  if (Number.isFinite(R) && R > 0) {
    // No bajar el nivel si las ciegas tampoco bajaron
    if (prevLevel > 0 && R < prevLevel && !blindsWentDown) return prevLevel;
    return R;
  }

  // 2) Level explícito (fallback por si TTD3 no envía RoundNum pero sí Level)
  const L = Number(body.Level ?? body.level);
  if (Number.isFinite(L) && L > 0) return L;

  // 3) Override textual (último recurso)
  const overrideText = parseVisibleLevelFromText(body);
  if (Number.isFinite(overrideText) && overrideText > 0) {
    if (prevLevel > 0 && overrideText < prevLevel && !blindsWentDown) return prevLevel;
    return overrideText;
  }

  // 4) Sin dato: mantener nivel previo
  return prevLevel;
}

/**
 * Calcula el tiempo hasta el próximo descanso usando la estructura completa.
 * @param {Array} rounds - Estructura de rounds/breaks del torneo
 * @param {number} currentRound - Round actual
 * @param {number} secondsLeft - Segundos restantes en el round actual
 * @param {number} defaultDurationMin - Duración por defecto si no hay estructura
 * @returns {Object} { breakInfo, totalSeconds }
 */
function calculateBreakFromStructure(rounds, currentRound, secondsLeft, defaultDurationMin) {
  if (!rounds || rounds.length === 0) {
    return { breakInfo: {}, totalSeconds: 0 };
  }

  // Encontrar la posición del round actual
  let currentPos = 0;
  for (const r of rounds) {
    if (!r.isBreak && r.number === currentRound) {
      currentPos = r.position;
      break;
    }
  }
  if (currentPos === 0) currentPos = currentRound;

  // Encontrar el próximo break después de la posición actual
  let nextBreak = null;
  for (const r of rounds) {
    if (r.isBreak && r.position > currentPos) {
      nextBreak = r;
      break;
    }
  }

  // Si no hay break futuro, buscar el primero
  if (!nextBreak) {
    for (const r of rounds) {
      if (r.isBreak) {
        nextBreak = r;
        break;
      }
    }
  }

  if (!nextBreak) {
    return { breakInfo: {}, totalSeconds: 0 };
  }

  // Calcular segundos hasta el break sumando duración de todos los items entre actual y break
  let totalSeconds = secondsLeft;
  let roundsUntil = 0;

  for (const r of rounds) {
    if (r.position <= currentPos || r.position >= nextBreak.position) continue;
    if (r.isBreak) continue;

    totalSeconds += (r.durationMin || defaultDurationMin) * 60;
    roundsUntil++;
  }

  return {
    breakInfo: {
      roundNumber: nextBreak.position,
      label: nextBreak.label,
      breakNumber: nextBreak.breakNumber,
      roundsUntil: roundsUntil,
      durationMin: nextBreak.durationMin,
    },
    totalSeconds,
  };
}

/* ───────────── TD3: recibir estructura del torneo (CSV) ───────────── */
exports.td3Structure = onRequest(
  { region: 'us-central1', secrets: [TD3_API_KEY] },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        const apiKey = req.get('x-api-key') || (req.query && req.query.key);
        const expectedKey = TD3_API_KEY.value()?.trim();
        if (!expectedKey || apiKey !== expectedKey) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const rawBody = req.body;
        if (!rawBody || (typeof rawBody !== 'string' && !rawBody.csv)) {
          return res.status(400).json({ error: 'Missing CSV data' });
        }

        const csvData = typeof rawBody === 'string' ? rawBody : rawBody.csv;
        const parsed = parseTD3StructureCSV(csvData);

        if (!parsed || parsed.length === 0) {
          return res.status(400).json({ error: 'Invalid CSV format' });
        }

        // Tournament ID from query param (default: currentTournament)
        const tournamentId = (req.query && req.query.tournament) ? String(req.query.tournament).trim() : 'currentTournament';

        // Guardar estructura en Firestore
        const structureRef = db.doc(`td3/structure_${tournamentId}`);
        await structureRef.set({
          rounds: parsed,
          totalRounds: parsed.filter(r => !r.isBreak).length,
          totalBreaks: parsed.filter(r => r.isBreak).length,
          totalDuration: parsed.reduce((sum, r) => sum + (r.durationMin || 0), 0),
          tournamentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          ok: true,
          rounds: parsed.length,
          breaks: parsed.filter(r => r.isBreak).length,
        });
      } catch (e) {
        console.error('[td3Structure] error', e);
        return res.status(500).json({ error: 'Server error' });
      }
    });
  }
);

/**
 * Parsea una línea CSV respetando campos entre comillas.
 * Maneja comas dentro de comillas (ej: "1,000") y comillas escapadas.
 */
function parseCSVLine(line, separator = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (inQuotes) {
      if (char === '"') {
        // Comilla escapada ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parsea el CSV exportado por TD3.
 * Formato esperado (columnas en español):
 * Nivel, Duración, Ciega pequeña, Ciega grande, Ante, Inicio, Cambio de fichas
 * Los descansos tienen "Descanso" o "Break" en la columna Nivel.
 */
function parseTD3StructureCSV(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detectar separador (coma o punto y coma)
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  const headers = parseCSVLine(firstLine, separator).map(h => h.trim().toLowerCase());

  // Mapear columnas por nombre
  const colMap = {};
  headers.forEach((h, i) => {
    if (h.includes('nivel') || h.includes('level') || h.includes('round')) colMap.level = i;
    if (h.includes('duración') || h.includes('duration') || h.includes('duracion')) colMap.duration = i;
    if (h.includes('ciega pequeña') || h.includes('small blind') || h.includes('sb')) colMap.sb = i;
    if (h.includes('ciega grande') || h.includes('big blind') || h.includes('bb')) colMap.bb = i;
    if (h.includes('ante')) colMap.ante = i;
    if (h.includes('inicio') || h.includes('start')) colMap.start = i;
    if (h.includes('cambio') || h.includes('chip')) colMap.chipChange = i;
  });

  const rounds = [];
  let roundCounter = 0;
  let breakCounter = 0;
  let position = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], separator);
    if (cols.length < 2) continue;

    const levelRaw = cols[colMap.level ?? 0] || '';
    const isBreak = /descanso|break|pause/i.test(levelRaw);
    const durationRaw = cols[colMap.duration ?? 1] || '0';

    // Parsear duración (puede ser "10", "10:00", "10 min", etc.)
    let durationMin = 0;
    const durMatch = durationRaw.match(/(\d+)/);
    if (durMatch) durationMin = parseInt(durMatch[1], 10);

    if (isBreak) breakCounter++;
    else roundCounter++;

    const sbRaw = (cols[colMap.sb] ?? '').replace(/,/g, '');
    const bbRaw = (cols[colMap.bb] ?? '').replace(/,/g, '');
    const anteRaw = (cols[colMap.ante] ?? '').replace(/,/g, '');

    const entry = {
      id: isBreak ? `break_${breakCounter}` : `round_${roundCounter}`,
      position: ++position,
      number: isBreak ? 0 : roundCounter,
      breakNumber: isBreak ? breakCounter : 0,
      isBreak,
      label: levelRaw || (isBreak ? `Descanso ${breakCounter}` : `Nivel ${roundCounter}`),
      durationMin,
      durationSec: durationMin * 60,
      smallBlind: num(sbRaw),
      bigBlind: num(bbRaw),
      ante: num(anteRaw),
      startTime: cols[colMap.start] || '',
      chipChange: cols[colMap.chipChange] || '',
    };

    rounds.push(entry);
  }

  return rounds;
}

/* ───────────── TD3: recibir estado básico ───────────── */
exports.td3Status = onRequest(
  { region: 'us-central1', secrets: [TD3_API_KEY] },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        const apiKey = req.get('x-api-key') || (req.query && req.query.key);
        const expectedKey = TD3_API_KEY.value()?.trim();
        if (!expectedKey || apiKey !== expectedKey) {
          console.warn('[td3Status] forbidden: bad key');
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const body =
          req.is('application/json') ? (req.body || {}) :
          (typeof req.body === 'string'
            ? Object.fromEntries(new URLSearchParams(req.body))
            : (req.body || {}));

        if (!body || typeof body !== 'object') {
          return res.status(400).json({ error: 'Invalid payload' });
        }

        // Tournament ID from query param (default: currentTournament)
        const tournamentId = (req.query && req.query.tournament) ? String(req.query.tournament).trim() : 'currentTournament';

      // Estado / pausa explícita
      const stateNorm = normalizeState(body.state ?? body.stateDesc ?? body.StateDesc);
      const pausedFromFlags =
        firstNum(body.paused, body.Paused, body.IsPaused, body.onHold, body.OnHold, body.Hold, body.ClockPaused, body.clockPaused) === 1;
      const paused =
        pausedFromFlags ||
        stateNorm === 'paused' || stateNorm === 'hold' || stateNorm === 'onhold';

      // Entrantes crudos
      const secsLeftIn = firstNum(body.levelSecondsRemaining, body.secondsLeft, body.SecondsLeft);
      const sbIn       = firstNum(body.smallBlind, body.smallblind, body.SmallBlind);
      const bbIn       = firstNum(body.bigBlind,   body.bigblind,   body.BigBlind);
      const anteIn     = firstNum(body.ante, body.Ante);

      // Doc previo
      const ref = db.doc(`td3/${tournamentId}`);
      const prevSnap = await ref.get();
      const prev = prevSnap.exists ? (prevSnap.data() || {}) : null;

      // Cargar estructura del torneo si existe
      const structureSnap = await db.doc(`td3/structure_${tournamentId}`).get();
      const structure = structureSnap.exists ? (structureSnap.data() || {}) : null;
      const roundsStructure = structure?.rounds || [];

      //  Nivel final ────────────────────────────────────────────────────────
      const isBreakNow = firstNum(body.isBreak, body.IsBreak) === 1;
      let levelFinal;
      if (isBreakNow && prev && Number(prev.level) > 0) {
        levelFinal = Number(prev.level);
      } else {
        levelFinal = pickLevelSmart({ body, prev, sbIn, bbIn, anteIn });
      }

      // ─ Cálculo de tiempo hasta el próximo descanso ───────────────────────
      // PRIORIDAD 1: Usar estructura completa del torneo (si está cargada)
      // PRIORIDAD 2: Fallback a detección por NextIsBreak (si no hay estructura)
      const currentRound = firstNum(body.RoundNum, body.round, levelFinal);
      const levelDurationMin = firstNum(body.LevelDuration, body.levelDuration, body.NextLevelDuration, 10);
      const nextIsBreakNow = firstNum(body.nextIsBreak, body.NextIsBreak) === 1;

      let breakRound = prev?.breakRound || 0;
      let secondsUntilBreak = 0;
      let roundsUntilBreak = 0;
      let nextBreakLabel = '';
      let nextBreakNumber = 0;

      if (roundsStructure.length > 0) {
        // Calcular usando la estructura completa
        const { breakInfo, totalSeconds } = calculateBreakFromStructure(
          roundsStructure,
          currentRound,
          secsLeftIn,
          levelDurationMin
        );
        breakRound = breakInfo.roundNumber || 0;
        secondsUntilBreak = totalSeconds;
        roundsUntilBreak = breakInfo.roundsUntil || 0;
        nextBreakLabel = breakInfo.label || '';
        nextBreakNumber = breakInfo.breakNumber || 0;
      } else {
        // Fallback: detección por NextIsBreak
        const prevNextIsBreak = prev ? (firstNum(prev.nextIsBreak) === 1) : false;
        if (nextIsBreakNow && !prevNextIsBreak && currentRound > 0) {
          breakRound = currentRound + 1;
        }
        if (isBreakNow) {
          breakRound = 0;
        }
        if (breakRound > 0 && currentRound > 0 && !isBreakNow) {
          roundsUntilBreak = Math.max(0, breakRound - currentRound);
          secondsUntilBreak = secsLeftIn + (roundsUntilBreak * levelDurationMin * 60);
        }
        if (nextIsBreakNow && !isBreakNow) {
          secondsUntilBreak = secsLeftIn;
          roundsUntilBreak = 0;
        }
      }

      const data = {
        // meta
        raw: body,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),

        // nombres
        tournamentName: txt(body.tournamentName ?? body.name ?? body.Title, ''),
        eventName:      txt(body.eventName ?? body.tournamentName ?? body.Title ?? body.name, ''),

        // nivel / reloj
        level: levelFinal,
        levelSecondsRemaining: secsLeftIn,
        elapsedSeconds:        firstNum(body.elapsedSeconds, body.SecondsElapsed),
        clock: txt(body.clock ?? body.Clock ?? body.clockText ?? body.ClockText, ''),

        // flags de descanso
        isBreak:          firstNum(body.isBreak,     body.IsBreak)     === 1 ? 1 : 0,
        nextIsBreak:      firstNum(body.nextIsBreak, body.NextIsBreak) === 1 ? 1 : 0,
        breakRound:       breakRound,
        roundsUntilBreak: roundsUntilBreak,
        secondsUntilBreak: secondsUntilBreak,
        nextBreakLabel:   nextBreakLabel,
        nextBreakNumber:  nextBreakNumber,
        hasStructure:     roundsStructure.length > 0,

        // blinds actuales
        smallBlind: sbIn,
        bigBlind:   bbIn,
        ante:       anteIn,

        // siguientes
        nextSmallBlind: firstNum(body.nextSmallBlind, body.NextSmallBlind),
        nextBigBlind:   firstNum(body.nextBigBlind,   body.NextBigBlind),
        nextAnte:       firstNum(body.nextAnte,       body.NextAnte),

        // participantes
        entrants:         firstNum(body.entrants, body.totalPlayers, body.players, body.Buyins, body.Entrants),
        playersRemaining: firstNum(body.playersRemaining, body.playersLeft, body.PlayersLeft),

        // economía y tiempos especiales (tokens oficiales XML)
        // PROTECCIÓN: Solo actualizamos si el dato viene en el body o tiene un fallback válido.
        nextBreak:      body.nextBreak ?? body.NextBreak ?? prev?.nextBreak ?? '',
        nextBreakAt:    body.nextBreakAt ?? body.NextBreakAt ?? prev?.nextBreakAt ?? '',
        addonTimeLeft:  body.addonTimeLeft ?? body.AddonTimeLeft ?? (body.AddonsSecondsLeft !== undefined ? String(body.AddonsSecondsLeft) : null) ?? prev?.addonTimeLeft ?? '',
        rebuyTimeLeft:  body.rebuyTimeLeft ?? body.RebuyTimeLeft ?? prev?.rebuyTimeLeft ?? '',
        prizes:         body.prizes ?? body.Prizes ?? prev?.prizes ?? '',
        payouts:        body.payouts ?? body.Payouts ?? prev?.payouts ?? '',

        // economía extendida
        rebuys:   firstNum(body.rebuys,   body.TotalRebuys),
        addons:   firstNum(body.addons,   body.addOns, body.TotalAddons),
        buyin:    firstNum(body.buyin,    body.buyIn),
        currency: txt(body.currency ?? body.Currency, 'MXN'),
        rebuysAllowed: firstNum(body.rebuysAllowed, body.RebuysAllowed, 1) === 1,
        addonsAllowed: firstNum(body.addonsAllowed, body.AddonsAllowed, 1) === 1,
        addonsSecondsLeft: firstNum(body.addonsSecondsLeft, body.AddonsSecondsLeft, null),
        rebuysSecondsLeft: firstNum(body.rebuysSecondsLeft, body.RebuysSecondsLeft, null),

        // Pozo y fichas totales
        pot:       firstNum(body.pot,       body.Pot,       body.GuaranteedPot),
        chipCount: firstNum(body.chipCount, body.ChipCount, body.UnadjustedChipCount),

        // estado textual y pausa
        state: stateNorm,
        paused: paused ? 1 : 0,
      };

      // endsAt: no durante break ni cuando esta pausado
      const shouldSetEndsAt = !data.paused && !isBreakNow;
      const secs = data.levelSecondsRemaining;
      data.endsAt = (shouldSetEndsAt && secs > 0)
        ? admin.firestore.Timestamp.fromMillis(Date.now() + secs * 1000)
        : null;

      await ref.set(data, { merge: false });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).send('Server error');
    }
  });
});

/* ───────────── TD3: obtener estado actual del torneo ───────────── */
exports.td3GetStatus = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

        const tournamentId = sanitizeId((req.query && req.query.tournament) ? String(req.query.tournament).trim() : null) || 'currentTournament';
        const snap = await db.doc(`td3/${tournamentId}`).get();
        if (!snap.exists) {
          return res.status(404).json({ error: 'No tournament data found' });
        }

        const data = snap.data();
        return res.json({
          ok: true,
          tournamentId,
          level: data.level,
          secondsUntilBreak: data.secondsUntilBreak,
          roundsUntilBreak: data.roundsUntilBreak,
          hasStructure: data.hasStructure,
          nextBreakLabel: data.nextBreakLabel,
          breakRound: data.breakRound,
          isBreak: data.isBreak,
          nextIsBreak: data.nextIsBreak,
          tournamentName: data.tournamentName,
          smallBlind: data.smallBlind,
          bigBlind: data.bigBlind,
          playersRemaining: data.playersRemaining,
          state: data.state,
        });
      } catch (e) {
        console.error('[td3GetStatus] error', e);
        return res.status(500).json({ error: 'Server error' });
      }
    });
  }
);

/* ───────────── TD3: obtener estructura del torneo ───────────── */
exports.td3GetStructure = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

        const tournamentId = sanitizeId((req.query && req.query.tournament) ? String(req.query.tournament).trim() : null) || 'currentTournament';
        const snap = await db.doc(`td3/structure_${tournamentId}`).get();
        if (!snap.exists) {
          return res.status(404).json({ error: 'No structure found' });
        }

        const data = snap.data();
        return res.json({
          ok: true,
          tournamentId,
          rounds: data.rounds,
          totalRounds: data.totalRounds,
          totalBreaks: data.totalBreaks,
          totalDuration: data.totalDuration,
          updatedAt: data.updatedAt,
        });
      } catch (e) {
        console.error('[td3GetStructure] error', e);
        return res.status(500).json({ error: 'Server error' });
      }
    });
  }
);

/* ───────────── Admin tool: otorgar claim admin ───────────── */
const ADMIN_TOOL_KEY = defineSecret('ADMIN_TOOL_KEY');

exports.setAdmin = onRequest(
  { region: 'us-central1', secrets: [ADMIN_TOOL_KEY] },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'POST') {
          return res.status(405).send('Method Not Allowed');
        }
        const keyFromReq =
          req.get('x-api-key') ||
          (req.query && req.query.key) ||
          (req.body && (req.body.key || req.body.apiKey));
        const expected = ADMIN_TOOL_KEY.value()?.trim();
        if (!expected || keyFromReq !== expected) {
          console.warn('[setAdmin] forbidden: bad key]');
          return res.status(403).json({ ok: false, error: 'forbidden' });
        }
        const email =
          (req.query && req.query.email) ||
          (req.body && req.body.email);
        if (!email) {
          return res.status(400).json({ ok: false, error: 'missing-email' });
        }
        const role = (req.body && req.body.role) || 'admin';
        const user = await admin.auth().getUserByEmail(String(email));
        const claims = role === 'superAdmin'
          ? { admin: true, superAdmin: true }
          : { admin: true };
        await admin.auth().setCustomUserClaims(user.uid, claims);
        return res.json({ ok: true, uid: user.uid, claims });
      } catch (e) {
        console.error('[setAdmin] error', e);
        return res.status(500).json({ ok: false, error: 'server-error' });
      }
    });
  }
);

/* ───────────── Admin tool: eliminar torneo y estructura ───────────── */
exports.td3DeleteTournament = onRequest(
  { region: 'us-central1', secrets: [ADMIN_TOOL_KEY] },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          return res.status(405).send('Method Not Allowed');
        }

        const keyFromReq =
          req.get('x-api-key') ||
          (req.query && req.query.key) ||
          (req.body && (req.body.key || req.body.apiKey));
        const expected = ADMIN_TOOL_KEY.value()?.trim();
        if (!expected || keyFromReq !== expected) {
          console.warn('[td3DeleteTournament] forbidden: bad key');
          return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const body = req.is('application/json') ? (req.body || {}) : {};
        const tournamentId = (req.query && req.query.tournament)
          ? String(req.query.tournament).trim()
          : (body.tournamentId || 'currentTournament');

        await db.doc(`td3/${tournamentId}`).delete();
        await db.doc(`td3/structure_${tournamentId}`).delete();

        console.log(`[td3DeleteTournament] deleted tournament: ${tournamentId}`);
        return res.json({ ok: true, deleted: tournamentId });
      } catch (e) {
        console.error('[td3DeleteTournament] error', e);
        return res.status(500).json({ error: 'Server error' });
      }
    });
  }
);

/* ───────────── Admin tool: limpiar el torneo del lobby ───────────── */
exports.td3Clear = onRequest(
  { region: 'us-central1', secrets: [ADMIN_TOOL_KEY] },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'POST') {
          return res.status(405).send('Method Not Allowed');
        }
        const keyFromReq =
          req.get('x-api-key') ||
          (req.query && req.query.key) ||
          (req.body && (req.body.key || req.body.apiKey));
        const expected = ADMIN_TOOL_KEY.value()?.trim();
        if (!expected || keyFromReq !== expected) {
          console.warn('[td3Clear] forbidden: bad key');
          return res.status(403).json({ ok: false, error: 'forbidden' });
        }
        await db.doc('td3/currentTournament').delete();
        await db.doc('td3/structure').delete();
        return res.json({ ok: true, deleted: true });
      } catch (e) {
        console.error('[td3Clear] error', e);
        return res.status(500).json({ ok: false, error: 'server-error' });
      }
    });
  }
);
