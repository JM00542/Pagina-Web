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
 
const VOLUME = 0.5;
 
let selectedMode = null;
let fadeTimer = null;
 
if (
  gate && music && soundBt && modal &&
  emailForm && emailInput && emailClose && emailError
) {
  document.body.classList.add('locked');
 
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
    selectedMode = selectedMode || 'silent';
    emailError.hidden = true;
    modal.hidden = false;
    emailInput.value = '';
 
    requestAnimationFrame(() => {
      emailInput.focus();
    });
  }
 
  function closeEmailModal() {
    modal.hidden = true;
    emailError.hidden = true;
    selectedMode = null;
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
        .catch(() => {
          updateButton();
        });
    } else {
      music.pause();
      updateButton();
    }
 
    setTimeout(() => {
      if (selectedMode !== null) {
        openEmailModal();
      }
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
 
  emailForm.addEventListener('submit', (event) => {
    event.preventDefault();
 
    if (!emailInput.checkValidity()) {
      emailError.hidden = false;
      emailInput.focus();
      return;
    }
 
    const email = emailInput.value.trim();
 
    if (!email) {
      emailError.hidden = false;
      emailInput.focus();
      return;
    }
 
    // Solo valida el correo; no lo envía a un servidor.
    console.log('Correo ingresado:', email);
 
    closeEmailModal();
    selectedMode = null;
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
      music.pause();
      clearInterval(fadeTimer);
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
 
      // ---------------------------------------------
      // ONDAS SENOIDALES SOBRE LOS ANILLOS
      // ---------------------------------------------
 
     
      // Ondulación suave: conserva la forma circular
      float wave1 = sin(angle * 4.0 - uTime * 1.2);
      float wave2 = sin(angle * 7.0 + uTime * 0.7);
 
      // Amplitud pequeña para evitar picos
      float distortion =
          wave1 * 0.006
        + wave2 * 0.002;
 
      // Círculo con ondas suaves
      float r = radius
        + distortion * smoothstep(0.0, 0.15, radius);
 
      // ---------------------------------------------
      // ANILLOS FINOS EN EXPANSIÓN
      // ---------------------------------------------
 
      float phase = r * 100.0 - uTime * 4.50;
 
      float wave = cos(phase);
 
      float thinRing = pow(
        max(wave, 0.0),
        18.0
      );
 
      // Halo luminoso de los anillos
      float glow = exp(
        -pow(sin(phase), 2.0) * 5.0
      );
 
      // ---------------------------------------------
      // BANDAS AZULES GRUESAS
      // ---------------------------------------------
 
      float broadPhase = r * 38.0 - uTime * 1.65;
 
      float broadRing = pow(
        max(cos(broadPhase), 0.0),
        5.0
      );
 
      // Pulsación de la luz
      float pulse = 0.82 + 0.18 * sin(uTime * 0.65);
 
      // ---------------------------------------------
      // PALETA ORIGINAL: NEGRO, AZUL Y CIAN
      // ---------------------------------------------
 
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
 
      // ---------------------------------------------
      // VIÑETA OSCURA
      // ---------------------------------------------
 
      float vignette = smoothstep(
        0.15,
        0.95,
        length(p)
      );
 
      color *= 1.0 - vignette * 0.72;
 
      // ---------------------------------------------
      // RESPLANDOR SUTIL DEL PUNTERO
      // ---------------------------------------------
 
      float pointerDistance = distance(
        uv,
        vec2(uPointer.x, 1.0 - uPointer.y)
      );
 
      float pointerGlow =
        exp(-pointerDistance * 8.0) * 0.025;
 
      color += electricBlue * pointerGlow;
 
      gl_FragColor = vec4(
        clamp(color, 0.0, 1.0),
        1.0
      );
    }
  `;
 
  // ---------------------------------------------
  // COMPILACIÓN DE SHADERS
  // ---------------------------------------------
 
  function compileShader(type, source) {
    const shader = gl.createShader(type);
 
    if (!shader) {
      console.error('No se pudo crear el shader.');
      return null;
    }
 
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
 
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(
        'Error compilando shader:',
        gl.getShaderInfoLog(shader)
      );
 
      gl.deleteShader(shader);
      return null;
    }
 
    return shader;
  }
 
  const vs = compileShader(
    gl.VERTEX_SHADER,
    vertexShader
  );
 
  const fs = compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShader
  );
 
  if (!vs || !fs) return;
 
  const program = gl.createProgram();
 
  if (!program) {
    console.error('No se pudo crear el programa WebGL.');
    return;
  }
 
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
 
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      'Error enlazando programa:',
      gl.getProgramInfoLog(program)
    );
 
    gl.deleteProgram(program);
    return;
  }
 
  gl.useProgram(program);
 
  // ---------------------------------------------
  // TRIÁNGULO A PANTALLA COMPLETA
  // ---------------------------------------------
 
  const buffer = gl.createBuffer();
 
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
 
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       3, -1,
      -1,  3
    ]),
    gl.STATIC_DRAW
  );
 
  const aPosition = gl.getAttribLocation(
    program,
    'aPosition'
  );
 
  gl.enableVertexAttribArray(aPosition);
 
  gl.vertexAttribPointer(
    aPosition,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
 
  const uResolution = gl.getUniformLocation(
    program,
    'uResolution'
  );
 
  const uTime = gl.getUniformLocation(
    program,
    'uTime'
  );
 
  const uPointer = gl.getUniformLocation(
    program,
    'uPointer'
  );
 
  // ---------------------------------------------
  // ANIMACIÓN
  // ---------------------------------------------
 
  let pointerX = 0.5;
  let pointerY = 0.5;
 
  let animationFrame = null;
  let running = false;
  let startTime = performance.now();
 
  function resize() {
    const width = Math.max(
      1,
      Math.floor(window.innerWidth * QUALITY)
    );
 
    const height = Math.max(
      1,
      Math.floor(window.innerHeight * QUALITY)
    );
 
    if (
      canvas.width !== width ||
      canvas.height !== height
    ) {
      canvas.width = width;
      canvas.height = height;
    }
 
    gl.viewport(0, 0, width, height);
 
    gl.uniform2f(
      uResolution,
      canvas.width,
      canvas.height
    );
 
    render();
  }
 
  function render() {
    const elapsed = reduceMotion
      ? 0
      : (performance.now() - startTime) / 1000;
 
    gl.uniform1f(uTime, elapsed);
 
    gl.uniform2f(
      uPointer,
      pointerX,
      pointerY
    );
 
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
 
    // Conserva el movimiento del tiempo al volver
    // de una pestaña que estuvo en segundo plano.
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
 
  // Movimiento del puntero
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
 
  // Dibujo inicial
  resize();
 
  if (reduceMotion) {
    render();
  } else {
    start();
  }
})();