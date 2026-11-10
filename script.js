/* =========================================================
   1. ENTRADA, PÁGINA PRINCIPAL, CORREO Y MÚSICA
   ========================================================= */

const gate = document.getElementById('gate');
const music = document.getElementById('bg-music');
const soundBt = document.getElementById('sound');

const modal = document.getElementById('email-modal');
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('subscriber-email');
const emailClose = document.getElementById('email-close');
const emailError = document.getElementById('email-error');
const emailOk = document.getElementById('email-ok');

const VOLUME = 0.5;

// Acceso seguro a localStorage: algunos navegadores (p. ej. Edge con prevención
// de rastreo estricta) lo bloquean y lanzan un error. Así no se rompe el modal.
const almacen = {
  get(clave) {
    try { return localStorage.getItem(clave); } catch (_) { return null; }
  },
  set(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (_) {}
  },
  remove(clave) {
    try { localStorage.removeItem(clave); } catch (_) {}
  }
};

let selectedMode = null;
let fadeTimer = null;

if (
  gate && music && soundBt && modal &&
  emailForm && emailInput && emailClose && emailError
) {
  document.body.classList.add('locked');

  // Para pruebas: abre necio.html?reset y se borra la marca de "ya suscrito"
  if (new URLSearchParams(window.location.search).has('reset')) {
    almacen.remove('nexxora_subscribed');
    almacen.remove('nexxora_user_email');
    console.info('Marca de suscripción borrada: el modal volverá a aparecer.');
  }

  function updateButton() {
    soundBt.textContent = music.paused ? '♪ OFF' : '♪ ON';
  }

  function fadeIn() {
    clearInterval(fadeTimer);
    music.volume = 0;

    fadeTimer = setInterval(() => {
      if (music.paused) {
        clearInterval(fadeTimer);
        return;
      }

      music.volume = Math.min(VOLUME, music.volume + 0.05);

      if (music.volume >= VOLUME) {
        clearInterval(fadeTimer);
      }
    }, 120);
  }

  function openEmailModal() {
    // El admin entra directo, sin el modal de suscripción
    if (window.necioAdmin) return;

    // Si ya se suscribió previamente, no mostramos el modal
    if (almacen.get('nexxora_subscribed')) {
      console.info('Modal de correo omitido: este navegador ya se suscribió. Usa necio.html?reset para verlo de nuevo.');
      return;
    }

    emailError.hidden = true;
    if (emailOk) emailOk.hidden = true;
    const botonEnviar = emailForm.querySelector('button[type="submit"]');
    if (botonEnviar) botonEnviar.disabled = false;
    modal.hidden = false;
    emailInput.value = '';

    requestAnimationFrame(() => {
      emailInput.focus();
    });
  }

  function closeEmailModal() {
    modal.hidden = true;
    emailError.hidden = true;
    if (emailOk) emailOk.hidden = true;
  }

  function enterSite(mode) {
    selectedMode = mode;

    gate.classList.add('hide');
    document.body.classList.remove('locked');
    window.scrollTo(0, 0);

    soundBt.style.display = 'inline-block';

    if (mode === 'sound') {
      music.play()
        .then(() => {
          fadeIn();
          updateButton();
        })
        .catch((err) => {
          console.warn('Autoplay bloqueado por el navegador:', err);
          updateButton();
        });
    } else {
      music.pause();
      updateButton();
    }

    setTimeout(() => {
      openEmailModal();
    }, 700);
  }

  document.getElementById('enter-sound')
    ?.addEventListener('click', () => enterSite('sound'));

  document.getElementById('enter-silent')
    ?.addEventListener('click', () => enterSite('silent'));

  emailClose.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeEmailModal();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeEmailModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeEmailModal();
    }
  });

  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      emailError.textContent = 'Introduce un correo electrónico válido.';
      emailError.hidden = false;
      emailInput.focus();
      return;
    }

    const submitBtn = emailForm.querySelector('button[type="submit"]');
    let exito = false;
    emailError.hidden = true;
    if (emailOk) emailOk.hidden = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Guarda el correo en Supabase (tabla "suscriptores")
      const resultado = await guardarEnSupabase('suscriptores', { correo: email, origen: 'necio' });
      exito = true;

      // Recordamos en este navegador que ya se suscribió (para no volver a mostrar el modal)
      almacen.set('nexxora_subscribed', 'true');
      almacen.set('nexxora_user_email', email);

      // Mensaje de éxito y cierre automático
      if (emailOk) {
        emailOk.textContent = resultado && resultado.duplicado
          ? '¡Listo! Ese correo ya estaba registrado.'
          : '¡Listo! Te suscribiste con éxito.';
        emailOk.hidden = false;
        setTimeout(closeEmailModal, 2000);
      } else {
        closeEmailModal();
      }
    } catch (error) {
      console.error('No se pudo guardar el correo:', error);
      emailError.textContent = 'No pudimos guardar tu correo. Inténtalo de nuevo.';
      emailError.hidden = false;
    } finally {
      // Si se guardó, el botón queda desactivado hasta que se cierre la ventana
      if (submitBtn && !exito) submitBtn.disabled = false;
    }
  });

  soundBt.addEventListener('click', async () => {
    if (music.paused) {
      try {
        await music.play();
        fadeIn();
      } catch (error) {
        console.warn('No se pudo reproducir la música:', error);
      }
    } else {
      clearInterval(fadeTimer);
      music.pause();
    }

    updateButton();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !music.paused) {
      music.pause();
      music.dataset.auto = '1';
      updateButton();
    } else if (!document.hidden && music.dataset.auto) {
      delete music.dataset.auto;

      music.play()
        .then(() => {
          fadeIn();
          updateButton();
        })
        .catch(() => {});
    }
  });
}


/* =========================================================
   2. FONDO WEBGL — TÚNEL DE ANILLOS NEÓN ONDULADOS
   Azul eléctrico · Cian · Ondas senoidales animadas
   ========================================================= */

(function neonTunnel() {
  const canvas = document.getElementById('gl');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power'
  });

  if (!gl) {
    console.warn('WebGL no disponible.');
    return;
  }

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const QUALITY = Math.min(
    window.devicePixelRatio || 1,
    window.innerWidth < 700 ? 1 : 1.5
  );

  const vertexShader = `
    attribute vec2 aPosition;

    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uPointer;

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;

      float aspect = uResolution.x / uResolution.y;

      // Coordenadas del túnel
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

      float radius = length(p);
      float angle = atan(p.y, p.x);

      // Ondulación suave: conserva la forma circular
      float wave1 = sin(angle * 4.0 - uTime * 1.2);
      float wave2 = sin(angle * 7.0 + uTime * 0.7);

      float distortion = wave1 * 0.006 + wave2 * 0.002;

      // Círculo con ondas suaves
      float r = radius + distortion * smoothstep(0.0, 0.15, radius);

      // Anillos finos en expansión
      float phase = r * 100.0 - uTime * 4.50;
      float wave = cos(phase);
      float thinRing = pow(max(wave, 0.0), 18.0);

      // Halo luminoso de los anillos
      float glow = exp(-pow(sin(phase), 2.0) * 5.0);

      // Bandas azules gruesas
      float broadPhase = r * 38.0 - uTime * 1.65;
      float broadRing = pow(max(cos(broadPhase), 0.0), 5.0);

      // Pulsación de la luz
      float pulse = 0.82 + 0.18 * sin(uTime * 0.65);

      // Paleta: Negro, azul y cian
      vec3 black = vec3(0.001, 0.002, 0.004);
      vec3 deepBlue = vec3(0.012, 0.025, 0.045);
      vec3 electricBlue = vec3(0.12, 0.30, 0.48);
      vec3 cyan = vec3(0.55, 0.80, 1.00);

      vec3 color = black;

      // Profundidad y resplandor
      color += deepBlue * glow * 0.35;
      color += electricBlue * glow * 0.42;
      color += electricBlue * broadRing * 0.45;

      // Anillos luminosos
      color += cyan * thinRing * 1.35 * pulse;

      // Núcleo central
      float core = exp(-radius * 45.0);
      color += cyan * core * 0.5;

      // Viñeta oscura
      float vignette = smoothstep(0.15, 0.95, length(p));
      color *= 1.0 - vignette * 0.72;

      // Resplandor del puntero
      float pointerDistance = distance(uv, vec2(uPointer.x, 1.0 - uPointer.y));
      float pointerGlow = exp(-pointerDistance * 8.0) * 0.025;
      color += electricBlue * pointerGlow;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Error compilando shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vertexShader);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShader);

  if (!vs || !fs) return;

  const program = gl.createProgram();
  if (!program) return;

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Error enlazando programa:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uPointer = gl.getUniformLocation(program, 'uPointer');

  let pointerX = 0.5;
  let pointerY = 0.5;
  let animationFrame = null;
  let running = false;
  let startTime = performance.now();

  function resize() {
    const width = Math.max(1, Math.floor(window.innerWidth * QUALITY));
    const height = Math.max(1, Math.floor(window.innerHeight * QUALITY));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    render();
  }

  function render() {
    const elapsed = reduceMotion ? 0 : (performance.now() - startTime) / 1000;
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uPointer, pointerX, pointerY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function animate() {
    if (document.hidden) {
      running = false;
      animationFrame = null;
      return;
    }
    render();
    animationFrame = requestAnimationFrame(animate);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    startTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = event.clientX / window.innerWidth;
      pointerY = event.clientY / window.innerHeight;
    },
    { passive: true }
  );

  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  resize();

  if (reduceMotion) {
    render();
  } else {
    start();
  }
})();