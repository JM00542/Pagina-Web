/* =========================================================
   NEXXORA · CONEXIÓN CON SUPABASE
   1) En Supabase: Project Settings → API
   2) Copia "Project URL" y la clave "anon public" aquí abajo.
   (La clave anon es pública por diseño; la seguridad la dan
    las políticas RLS de supabase.sql. NUNCA pongas aquí la
    clave "service_role".)
   ========================================================= */

const SUPABASE_URL = 'https://czxktyczurphfzpzbbpp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_z62DDhVY17GZDbhOC_SDEA_m0wT483m';

async function guardarEnSupabase(tabla, datos) {
  if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_ANON_KEY.includes('TU-CLAVE')) {
    throw new Error('Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en supabase.js');
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  // Las claves nuevas (sb_publishable_...) no son JWT: solo van en "apikey".
  // Las claves antiguas (eyJ...) también se envían como Bearer.
  if (!SUPABASE_ANON_KEY.startsWith('sb_')) {
    headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
  }

  const respuesta = await fetch(SUPABASE_URL + '/rest/v1/' + tabla, {
    method: 'POST',
    headers,
    body: JSON.stringify(datos)
  });

  if (respuesta.ok) return { ok: true };

  // Leemos el detalle del error que devuelve Supabase
  let detalle = {};
  try { detalle = await respuesta.json(); } catch (_) {}
  const codigo = detalle.code || '';

  // Correo repetido (índice único): lo tratamos como éxito
  if (respuesta.status === 409 || codigo === '23505') {
    return { ok: true, duplicado: true };
  }

  // Mensaje claro en la consola (F12) para saber qué falló
  let pista = '';
  if (respuesta.status === 404 || codigo === 'PGRST205') {
    pista = 'La tabla "' + tabla + '" no existe. Ejecuta supabase.sql en el SQL Editor.';
  } else if (respuesta.status === 401 || respuesta.status === 403 || codigo === '42501') {
    pista = 'Permiso denegado (RLS). Vuelve a ejecutar supabase.sql para crear las políticas de inserción.';
  } else if (codigo === 'PGRST204' || codigo === '23502') {
    pista = 'Las columnas no coinciden con los datos enviados. Revisa la tabla "' + tabla + '".';
  } else if (codigo === '23514') {
    pista = 'El dato no pasó las validaciones de la tabla (por ejemplo, el formato del correo).';
  }

  console.error('Supabase falló:', respuesta.status, detalle, pista);
  throw new Error('Supabase ' + respuesta.status + ' ' + codigo + ' ' + (detalle.message || '') + ' ' + pista);
}