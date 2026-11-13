/* =========================================================
   NECIO · LISTAS DESDE SUPABASE + PANEL DE ADMIN
   - Todos ven lanzamientos y eventos leídos de Supabase.
   - El admin inicia sesión y puede agregar, editar y eliminar.
   ========================================================= */
(function () {
  'use strict';

  const KEY = SUPABASE_ANON_KEY;
 
  const DOMINIO_ADMIN = 'nexxora.com';
  let token = null;
  let admin = false;

  const el = (tag, attrs, ...hijos) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    hijos.flat().forEach((h) => n.append(h));
    return n;
  };
  // Solo se aceptan enlaces http(s)
  const seguro = (u) => (/^https?:\/\//i.test((u || '').trim()) ? u.trim() : '');

  const LISTAS = {
    lanzamientos: { caja: 'lista-releases', tarjeta: tarjetaRelease },
    eventos: { caja: 'lista-eventos', tarjeta: tarjetaEvento }
  };

  const CAMPOS = {
    lanzamientos: [
      ['titulo', 'Título', 'text', true],
      ['subtitulo', 'Detalle (ej. 2026 · EP)', 'text'],
      ['imagen_url', 'URL de la imagen', 'url', true],
      ['enlace_url', 'URL de la música (Spotify, YouTube…)', 'url', true]
    ],
    eventos: [
      ['titulo', 'Nombre del evento', 'text', true],
      ['fecha_lugar', 'Lugar y fecha (ej. Sevilla, España | 6 de septiembre)', 'text'],
      ['imagen_url', 'URL de la imagen (flyer)', 'url', true],
      ['enlace_url', 'URL del evento (opcional)', 'url'],
      ['detalle', 'Detalles (una línea por párrafo)', 'textarea']
    ]
  };

  /* ---------- Tarjetas ---------- */
  function envolver(nodo, tabla, fila) {
    const caja = el('div', { class: 'item' }, nodo);
    if (admin) {
      caja.append(el('div', { class: 'admin-actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => editor(tabla, fila) }, 'Editar'),
        el('button', { type: 'button', class: 'btn', onclick: () => borrar(tabla, fila) }, 'Eliminar')
      ));
    }
    return caja;
  }

  function tarjetaRelease(x) {
    const a = el('a', { class: 'release', href: seguro(x.enlace_url) || '#', target: '_blank', rel: 'noopener noreferrer' },
      el('img', { src: seguro(x.imagen_url), alt: 'Portada de ' + x.titulo, width: '320', height: '320', loading: 'lazy' }),
      el('strong', {}, x.titulo),
      el('span', { class: 'muted' }, x.subtitulo || '')
    );
    return envolver(a, 'lanzamientos', x);
  }

  function tarjetaEvento(x) {
    const img = el('img', { src: seguro(x.imagen_url), alt: 'Flyer de ' + x.titulo, loading: 'lazy' });
    const portada = seguro(x.enlace_url)
      ? el('a', { href: seguro(x.enlace_url), target: '_blank', rel: 'noopener noreferrer' }, img)
      : img;
    const lineas = (x.detalle || '').split('\n').filter(Boolean).map((t) => el('p', { class: 'muted' }, t));
    const texto = el('div', {}, el('h3', {}, x.titulo), x.fecha_lugar ? el('p', {}, x.fecha_lugar) : '', lineas);
    return envolver(el('article', { class: 'event' }, portada, texto), 'eventos', x);
  }

  /* ---------- Supabase ---------- */
  async function leer(tabla) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabla + '?select=*&order=id.asc', { headers: { apikey: KEY } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function escribir(metodo, tabla, filtro, cuerpo) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + tabla + filtro, {
      method: metodo,
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    if (r.ok) return;
    if (r.status === 401) throw new Error('sesion');
    let d = {};
    try { d = await r.json(); } catch (_) {}
    console.error('Supabase falló:', r.status, d);
    throw new Error(d.message || 'HTTP ' + r.status);
  }

  async function login(correo, clave) {
    console.info('[admin.js v3] Intentando entrar como:', correo, '· proyecto:', SUPABASE_URL);
    const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password: clave })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) {
      console.error('Login falló:', r.status, d);
      const e = new Error(d.msg || d.error_description || 'login');
      e.codigo = d.error_code || '';
      throw e;
    }
    token = d.access_token; 
  }

  async function cargar(tabla) {
    const cfg = LISTAS[tabla];
    const caja = document.getElementById(cfg.caja);
    if (!caja) return;
    try {
      const filas = await leer(tabla);
      caja.replaceChildren(...filas.map(cfg.tarjeta));
    } catch (e) {
      console.warn('Se mantiene el contenido del HTML para', tabla, '(' + e.message + ')');
    }
  }

  const mensaje = (e) => (e.message === 'sesion'
    ? 'Tu sesión expiró. Pulsa "Salir" y entra de nuevo.'
    : 'No se pudo guardar: ' + e.message);

  /* ---------- Ventanas ---------- */
  function ventana(titulo, contenido) {
    const fondo = el('div', { class: 'email-modal' });
    fondo.append(el('div', { class: 'email-modal__box admin-box', role: 'dialog', 'aria-modal': 'true' },
      el('h2', {}, titulo), contenido));
    fondo.addEventListener('click', (e) => { if (e.target === fondo) fondo.remove(); });
    document.body.append(fondo);
    return fondo;
  }

  function abrirLogin() {
    const err = el('p', { class: 'email-modal__error', hidden: '' });
    const correo = el('input', { type: 'text', autocomplete: 'username', placeholder: 'Usuario', required: '' });
    const clave = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'contraseña', required: '' });
    const boton = el('button', { type: 'submit', class: 'btn fill email-modal__submit' }, 'Entrar');
    const form = el('form', { class: 'admin-form' }, el('label', {}, 'Usuario'), correo, el('label', {}, 'Contraseña'), clave, err, boton);
    const v = ventana('Admin', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      boton.disabled = true;
      let intento = '';
      try {
        const usuario = correo.value.trim().toLowerCase();
        intento = usuario.includes('@') ? usuario : usuario + '@' + DOMINIO_ADMIN;
        await login(intento, clave.value);
        v.remove();
        entrarAdmin();
      }
      catch (x) {
        const MOTIVOS = {
          invalid_credentials: 'Usuario o contraseña incorrectos.',
          email_not_confirmed: 'El usuario existe pero no está confirmado. En Supabase, abre Authentication → Users y confírmalo (o créalo con "Auto Confirm User").',
          email_provider_disabled: 'El inicio de sesión con correo está desactivado. Actívalo en Supabase: Authentication → Sign In / Providers → Email.'
        };
        const base = MOTIVOS[x.codigo] ||
          (x instanceof TypeError
            ? 'No se pudo conectar con Supabase. Revisa tu internet o la URL en supabase.js.'
            : 'No se pudo iniciar sesión (' + (x.codigo || x.message) + ').');
        // Detalle de diagnóstico (v3): qué correo se probó y en qué proyecto
        err.textContent = base + ' [v3 · correo: ' + intento + ' · proyecto: ' +
          SUPABASE_URL.replace('https://', '').split('.')[0] + ' · código: ' + (x.codigo || 'sin código') + ']';
        err.hidden = false;
        boton.disabled = false;
      }
    });
    correo.focus();
  }

  function editor(tabla, fila) {
    const err = el('p', { class: 'email-modal__error', hidden: '' });
    const campos = {};
    const form = el('form', { class: 'admin-form' });
    CAMPOS[tabla].forEach(([k, texto, tipo, obligatorio]) => {
      const i = tipo === 'textarea' ? el('textarea', { rows: '4' }) : el('input', { type: tipo });
      i.value = (fila && fila[k]) || '';
      if (obligatorio) i.required = true;
      campos[k] = i;
      form.append(el('label', {}, texto), i);
    });
    const guardar = el('button', { type: 'submit', class: 'btn fill email-modal__submit' }, fila ? 'Guardar cambios' : 'Agregar');
    const cancelar = el('button', { type: 'button', class: 'btn email-modal__submit', onclick: () => v.remove() }, 'Cancelar');
    form.append(err, guardar, cancelar);
    const v = ventana(fila ? 'Editar' : 'Agregar', form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {};
      Object.entries(campos).forEach(([k, i]) => { datos[k] = i.value.trim() || null; });
      const malo = ['imagen_url', 'enlace_url'].find((k) => datos[k] && !seguro(datos[k]));
      if (malo) { err.textContent = 'Las URLs deben empezar con http:// o https://'; err.hidden = false; return; }
      err.hidden = true;
      guardar.disabled = true;
      try {
        await escribir(fila ? 'PATCH' : 'POST', tabla, fila ? '?id=eq.' + fila.id : '', datos);
        v.remove();
        await cargar(tabla);
      } catch (x) { err.textContent = mensaje(x); err.hidden = false; guardar.disabled = false; }
    });
  }

  async function borrar(tabla, fila) {
    if (!confirm('¿Eliminar "' + fila.titulo + '"?')) return;
    try { await escribir('DELETE', tabla, '?id=eq.' + fila.id); await cargar(tabla); }
    catch (e) { alert(mensaje(e)); }
  }

  /* ---------- Modo admin ---------- */
  function entrarAdmin() {
    admin = true;
    window.necioAdmin = true; // script.js lo usa para no mostrar el modal de suscripción
    const silencio = document.getElementById('enter-silent');
    if (silencio) silencio.click();
    Object.keys(LISTAS).forEach((tabla) => {
      const caja = document.getElementById(LISTAS[tabla].caja);
      if (!caja) return;
      caja.before(el('button', { type: 'button', class: 'btn admin-add', onclick: () => editor(tabla) }, '＋ Agregar'));
      cargar(tabla);
    });
    document.body.append(el('div', { class: 'admin-bar' }, 'MODO ADMIN ',
      el('button', { type: 'button', onclick: () => location.reload() }, 'Salir')));
  }

  const botonAdmin = document.getElementById('enter-admin');
  if (botonAdmin) botonAdmin.addEventListener('click', abrirLogin);
  Object.keys(LISTAS).forEach(cargar);
})();