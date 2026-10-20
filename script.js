/* =========================================================
   1. PANTALLA DE ENTRADA Y MÚSICA
   Si la pantalla está comentada en el HTML, esta parte no
   hace nada. Si la descomentas, vuelve a funcionar sola.
   ========================================================= */
const gate    = document.getElementById('gate');
const music   = document.getElementById('bg-music');
const soundBt = document.getElementById('sound');
const VOLUME  = 0.5;   // volumen final (0 a 1)

if (gate && music && soundBt) {
  document.body.classList.add('locked');

  const openSite = () => {
    gate.classList.add('hide');
    document.body.classList.remove('locked');
    window.scrollTo(0, 0);
  };
  const updateButton = () => {
    soundBt.textContent = music.paused ? '♪ OFF' : '♪ ON';
  };
  const fadeIn = () => {
    music.volume = 0;
    const timer = setInterval(() => {
      music.volume = Math.min(VOLUME, music.volume + 0.05);
      if (music.volume >= VOLUME) clearInterval(timer);
    }, 120);
  };

  document.getElementById('enter-sound').addEventListener('click', () => {
    openSite();
    soundBt.style.display = 'block';
    music.play().then(() => { fadeIn(); updateButton(); }).catch(updateButton);
  });

  document.getElementById('enter-silent').addEventListener('click', () => {
    openSite();
    soundBt.style.display = 'block';
    updateButton();
  });

  soundBt.addEventListener('click', () => {
    if (music.paused) { music.play().catch(() => {}); fadeIn(); }
    else { music.pause(); }
    updateButton();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !music.paused) {
      music.pause(); music.dataset.auto = '1'; updateButton();
    } else if (!document.hidden && music.dataset.auto) {
      music.play().catch(() => {}); delete music.dataset.auto; updateButton();
    }
  });
}

/* =========================================================
   2. FONDO: ondas de agua (gotas que caen)
   WebGL puro, sin librerías. Si WebGL no está disponible,
   queda el fondo oscuro normal y la página sigue funcionando.
   ========================================================= */
(function waterBackground () {
  const canvas = document.getElementById('gl');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { console.warn('WebGL no disponible: sin fondo animado'); return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Ajustes que puedes tocar ---- */
  const MAX_DROPS   = 8;     // gotas visibles a la vez (no subir de 8 sin cambiar el shader)
  const SPEED       = 0.16;  // velocidad con que se expande cada onda
  const RINGS       = 60.0;  // cantidad de anillos por onda (más = más finos)
  const FADE        = 0.45;  // qué tan rápido se apaga la onda (más = más rápido)
  const GAP_MIN     = 1.4;   // segundos mínimos entre gotas automáticas
  const GAP_RANGE   = 2.2;   // segundos extra aleatorios
  const RENDER_SCALE = innerWidth < 700 ? 0.6 : 0.8;   // resolución interna (menos = más liviano)

  /* ---- Colores (azules oscuros) ---- */
  const BASE = '0.000, 0.012, 0.040';   // fondo  #00030a
  const MID  = '0.043, 0.165, 0.400';   // azul   #0b2a66
  const HI   = '0.239, 0.545, 1.000';   // acento #3d8bff

  const vert = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const frag = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2  uRes;
    uniform float uTime;
    uniform vec3  uDrops[${MAX_DROPS}];   // x, y, instante en que cayó

    void main(){
      vec2 uv  = gl_FragCoord.xy / uRes;
      float asp = uRes.x / uRes.y;
      vec2 p   = vec2(uv.x * asp, uv.y);

      float h = 0.0;       // altura del agua
      float flash = 0.0;   // destello del impacto

      for (int i = 0; i < ${MAX_DROPS}; i++) {
        vec3 d = uDrops[i];
        float age = uTime - d.z;
        if (d.z < -50.0 || age < 0.0 || age > 10.0) continue;

        vec2  c    = vec2(d.x * asp, d.y);
        float dist = distance(p, c);
        float behind = age * ${SPEED.toFixed(3)} - dist;     // >0 = dentro de la onda

        if (behind > 0.0) {
          float wave = sin(behind * ${RINGS.toFixed(1)});
          float env  = smoothstep(0.0, 0.035, behind)        // borde de ataque suave
                     * exp(-behind * 5.0)                     // anillos de atrás más débiles
                     * exp(-age * ${FADE.toFixed(2)})         // se apaga con el tiempo
                     / (1.0 + dist * 3.0);                    // pierde fuerza con la distancia
          h += wave * env;
        }
        flash += exp(-age * 7.0) * exp(-dist * dist * 3500.0);
      }

      vec3 base = vec3(${BASE});
      vec3 mid  = vec3(${MID});
      vec3 hi   = vec3(${HI});

      // respiración muy lenta del fondo, para que no sea plano
      float amb = 0.5 + 0.5 * sin(p.x * 2.0 + uTime * 0.10) * sin(p.y * 2.6 - uTime * 0.08);

      float crest  = max(h, 0.0);
      float trough = max(-h, 0.0);

      vec3 col = base + mid * 0.12 * amb;
      col += mid * crest * 1.7;
      col += hi  * pow(crest, 2.2) * 1.3;
      col -= base * trough * 0.6;
      col += hi  * flash * 0.8;

      // viñeta: oscurece los bordes
      col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length(uv - 0.5));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('Error de shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('Error al enlazar:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // Un triángulo gigante que cubre toda la pantalla
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(prog, 'uRes');
  const uTime  = gl.getUniformLocation(prog, 'uTime');
  const uDrops = gl.getUniformLocation(prog, 'uDrops');

  // Gotas: [x, y, instante]. -100 = hueco libre
  const drops = new Float32Array(MAX_DROPS * 3);
  for (let i = 0; i < MAX_DROPS; i++) drops[i*3+2] = -100;
  let slot = 0;

  const t0  = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  function addDrop(x, y, at = now()) {
    drops[slot*3]   = x;
    drops[slot*3+1] = y;
    drops[slot*3+2] = at;
    slot = (slot + 1) % MAX_DROPS;
  }

  function resize() {
    canvas.width  = Math.max(2, Math.round(innerWidth  * RENDER_SCALE));
    canvas.height = Math.max(2, Math.round(innerHeight * RENDER_SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  addEventListener('resize', resize);
  resize();

  function draw() {
    gl.uniform1f(uTime, now());
    gl.uniform3fv(uDrops, drops);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Si el usuario prefiere sin movimiento: una imagen fija con ondas ya formadas
  if (reduce) {
    addDrop(0.30, 0.65, -1.5);
    addDrop(0.72, 0.38, -3.0);
    draw();
    return;
  }

  // Gotas iniciales para que no arranque vacío
  addDrop(0.62, 0.60, -0.8);
  addDrop(0.28, 0.35, -2.4);

  // Gotas automáticas
  let nextDrop = 0.6;
  function autoDrop(t) {
    if (t >= nextDrop) {
      addDrop(0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.84, t);
      nextDrop = t + GAP_MIN + Math.random() * GAP_RANGE;
    }
  }

  // Interacción: clic o toque = gota; mover el mouse = gota ocasional
  let lastMove = 0;
  addEventListener('pointerdown', e => {
    addDrop(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
  });
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const t = now();
    if (t - lastMove < 1.1) return;
    lastMove = t;
    addDrop(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
  });

  let running = false;
  function frame() {
    if (document.hidden) { running = false; return; }
    autoDrop(now());
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  start();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
})();
