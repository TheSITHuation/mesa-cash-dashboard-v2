// src/services/firebase/googleSheetsService.js
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig.js';

/**
 * Obtiene la configuración de Google Sheets de Firestore (meta/config)
 * @returns {Promise<{googleSheetsUrl: string, cutoffHour: number}>}
 */
export async function getGoogleSheetsConfig() {
  try {
    const ref = doc(db, 'meta', 'config');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        googleSheetsUrl: data.googleSheetsUrl || '',
        cutoffHour: typeof data.cutoffHour === 'number' ? data.cutoffHour : 6
      };
    }
  } catch (err) {
    console.error('[googleSheetsService] Error obteniendo configuración:', err);
  }
  return { googleSheetsUrl: '', cutoffHour: 6 };
}

/**
 * Guarda la configuración de Google Sheets en Firestore (meta/config)
 * @param {string} url - URL de Google Apps Script Web App
 * @param {number} cutoffHour - Hora de corte operativa (0-23)
 */
export async function saveGoogleSheetsConfig(url, cutoffHour) {
  const ref = doc(db, 'meta', 'config');
  await setDoc(ref, {
    googleSheetsUrl: String(url || '').trim(),
    cutoffHour: Number(cutoffHour ?? 6)
  }, { merge: true });
}

/**
 * Calcula la fecha operativa basada en la hora de corte local.
 * Si la hora actual es anterior a la hora de corte, se asigna al día anterior.
 * @param {Date|number|string} date - Fecha a evaluar
 * @param {number} cutoffHour - Hora de corte (0-23, por defecto 6)
 * @returns {string} Fecha operativa en formato YYYY-MM-DD
 */
export function getOperatingDate(date, cutoffHour = 6) {
  const localDate = date ? new Date(date) : new Date();
  
  // Si la fecha es inválida, usar hoy
  if (isNaN(localDate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const hour = localDate.getHours(); // Hora en zona horaria local
  if (hour < cutoffHour) {
    localDate.setDate(localDate.getDate() - 1);
  }

  const y = localDate.getFullYear();
  const m = String(localDate.getMonth() + 1).padStart(2, '0');
  const d = String(localDate.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${d}`;
}

/**
 * Envía datos al Webhook de Google Apps Script.
 * Usa un POST simple sin cabeceras personalizadas para evitar CORS Preflight.
 * @param {string} type - Tipo de exportación ("daily_closure" o "table_closure")
 * @param {string} dateKey - Fecha operativa del reporte (YYYY-MM-DD)
 * @param {Object} payload - Objeto con datos de cierres y jugadores
 * @returns {Promise<{ok: boolean, url: string, error?: string}>}
 */
export async function exportToGoogleSheets(type, dateKey, payload) {
  const { googleSheetsUrl } = await getGoogleSheetsConfig();
  if (!googleSheetsUrl) {
    throw new Error('La URL de Google Sheets no está configurada. Configura la URL en ajustes.');
  }

  // Validar que sea una URL de Google Apps Script deploy (/exec), no /dev
  if (googleSheetsUrl.includes('/dev')) {
    throw new Error(
      'La URL configurada es de modo desarrollo (/dev). ' +
      'Usa la URL de implementación que termina en /exec.'
    );
  }

  const body = {
    type,
    date: dateKey,
    ...payload
  };

  let response;
  try {
    // Se envía sin cabecera Content-Type para evitar CORS preflight OPTIONS,
    // Google Apps Script procesará el cuerpo como texto plano y parseará el JSON.
    response = await fetch(googleSheetsUrl, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    throw new Error(
      'No se pudo conectar al webhook de Google Sheets. ' +
      'Verifica la URL y tu conexión a internet. (' + networkErr.message + ')'
    );
  }

  if (!response.ok) {
    // Intentar leer el cuerpo para más contexto
    let body403 = '';
    try { body403 = await response.text(); } catch (_) {}
    const isHtml = body403.trim().startsWith('<');
    if (isHtml) {
      throw new Error(
        `Google Apps Script devolvió una página HTML (status ${response.status}). ` +
        'Esto ocurre cuando el acceso del deploy NO está en "Cualquier persona" (Anyone), ' +
        'o cuando la URL termina en /dev en lugar de /exec. ' +
        'Ve a Implementar → Gestionar implementaciones y verifica la configuración.'
      );
    }
    throw new Error(`Error en servidor Google Script: ${response.status} ${response.statusText}`);
  }

  let result;
  try {
    result = await response.json();
  } catch (parseErr) {
    // Google redirigió a login (HTML) y el browser lo siguió — el body no es JSON
    throw new Error(
      'La respuesta del webhook no es JSON válido (posiblemente una página de login de Google). ' +
      'Asegúrate de que en tu implementación de Apps Script, "Quién tiene acceso" sea "Cualquier persona" ' +
      'y que hayas re-autorizado el script después del último cambio.'
    );
  }

  if (!result || result.ok === false) {
    throw new Error(result?.error || 'La exportación falló sin descripción de error.');
  }

  return result;
}
