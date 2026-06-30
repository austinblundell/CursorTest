/* ============================================================================
 * Hacker Terminal — 3D Cyber Intrusion
 * A movie-style "hacking" sequence: 3D Matrix rain, a glowing wireframe
 * cyber-globe streaked with attack arcs, a neon grid floor, and a live
 * terminal typing out a fake intrusion. Built on Three.js (r128, via CDN).
 * ==========================================================================*/
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x02060a, 1);
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02060a, 0.0095);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
  camera.position.set(0, 7, 40);
  camera.lookAt(0, 4, 0);

  // ---------------------------------------------------------------------------
  // Glyph atlas — 8×8 grid of katakana / digits / symbols drawn white on alpha.
  // ---------------------------------------------------------------------------
  const ATLAS_DIM = 8;
  const GLYPHS = (
    'アァカサタナハマヤラワガザダバパイキシチニヒミリギジヂビピウ' +
    'クスツヌフムユルグズブプ0123456789=<>*+#@$%&'
  ).split('').slice(0, ATLAS_DIM * ATLAS_DIM);

  function makeGlyphAtlas() {
    const cell = 64;
    const size = cell * ATLAS_DIM;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.floor(cell * 0.74)}px "Share Tech Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < GLYPHS.length; i++) {
      const cx = (i % ATLAS_DIM) * cell + cell / 2;
      const cy = Math.floor(i / ATLAS_DIM) * cell + cell / 2;
      ctx.fillText(GLYPHS[i], cx, cy);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  const glyphAtlas = makeGlyphAtlas();

  // ---------------------------------------------------------------------------
  // Matrix rain — columns of glyphs falling through 3D space (GPU shader).
  // ---------------------------------------------------------------------------
  const COLS = 220;
  const ROWS = 34;
  const ROW_GAP = 2.4;
  const TOP = (ROWS * ROW_GAP) / 2;
  const rainCount = COLS * ROWS;

  const rPos = new Float32Array(rainCount * 3);
  const rRow = new Float32Array(rainCount);
  const rSpeed = new Float32Array(rainCount);
  const rPhase = new Float32Array(rainCount);
  const rSeed = new Float32Array(rainCount);

  let p = 0;
  for (let c = 0; c < COLS; c++) {
    const x = (Math.random() * 2 - 1) * 78;
    const z = -14 - Math.random() * 70;
    const speed = 6 + Math.random() * 14;
    const phase = Math.random();
    for (let r = 0; r < ROWS; r++) {
      rPos[p * 3] = x;
      rPos[p * 3 + 1] = TOP - r * ROW_GAP;
      rPos[p * 3 + 2] = z;
      rRow[p] = r;
      rSpeed[p] = speed;
      rPhase[p] = phase;
      rSeed[p] = Math.random();
      p++;
    }
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  rainGeo.setAttribute('aRow', new THREE.BufferAttribute(rRow, 1));
  rainGeo.setAttribute('aSpeed', new THREE.BufferAttribute(rSpeed, 1));
  rainGeo.setAttribute('aPhase', new THREE.BufferAttribute(rPhase, 1));
  rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rSeed, 1));

  const rainMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRows: { value: ROWS },
      uTail: { value: 16.0 },
      uSize: { value: 26.0 },
      uPixelRatio: { value: PR },
      uAtlas: { value: glyphAtlas },
      uAtlasDim: { value: ATLAS_DIM },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aRow;
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aSeed;
      uniform float uTime, uRows, uTail, uSize, uPixelRatio;
      varying float vBright;
      varying float vSeed;
      varying float vHead;
      varying float vFade;
      void main() {
        float total = uRows + uTail;
        float head = mod(uTime * aSpeed + aPhase * total, total);
        float trail = head - aRow;
        float bright = 0.0;
        if (trail >= 0.0 && trail <= uTail) {
          bright = 1.0 - trail / uTail;
        }
        vBright = bright;
        vSeed = aSeed;
        vHead = trail;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFade = clamp((110.0 - (-mv.z)) / 80.0, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixelRatio * (300.0 / -mv.z);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uAtlas;
      uniform float uTime, uAtlasDim;
      varying float vBright;
      varying float vSeed;
      varying float vHead;
      varying float vFade;
      void main() {
        if (vBright <= 0.002) discard;
        float count = uAtlasDim * uAtlasDim;
        float gi = floor(mod(vSeed * count + floor(uTime * 7.0 + vSeed * 50.0), count));
        vec2 cell = vec2(mod(gi, uAtlasDim), floor(gi / uAtlasDim));
        vec2 uv = gl_PointCoord;
        uv.y = 1.0 - uv.y;
        vec2 auv = (cell + uv) / uAtlasDim;
        float mask = texture2D(uAtlas, auv).a;
        float a = mask * vBright * vFade;
        if (a < 0.02) discard;
        vec3 green = vec3(0.20, 1.0, 0.28);
        vec3 white = vec3(0.85, 1.0, 0.90);
        float isHead = step(vHead, 1.0);
        vec3 col = mix(green, white, isHead);
        col *= (0.35 + vBright * 1.05);
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const rain = new THREE.Points(rainGeo, rainMat);
  rain.renderOrder = 0;
  scene.add(rain);

  // ---------------------------------------------------------------------------
  // Cyber globe — wireframe icosphere + glowing core + surface nodes.
  // ---------------------------------------------------------------------------
  const GLOBE_R = 9;
  const globe = new THREE.Group();
  globe.position.set(0, 5, -2);
  scene.add(globe);

  const icoGeo = new THREE.IcosahedronGeometry(GLOBE_R, 3);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(icoGeo),
    new THREE.LineBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  globe.add(wire);

  // Dark inner sphere so wireframe reads as a solid globe, plus a faint glow.
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 0.985, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x021207 })
  );
  globe.add(core);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.18, 32, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: { uColor: { value: new THREE.Color(0x18e0ff) } },
      vertexShader: `
        varying float vIntensity;
        void main() {
          vec3 n = normalize(normalMatrix * normal);
          vec3 vp = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
          vIntensity = pow(1.0 - abs(dot(n, vp)), 2.2);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vIntensity;
        void main() {
          gl_FragColor = vec4(uColor * vIntensity, vIntensity * 0.9);
        }
      `,
    })
  );
  globe.add(glow);

  // Surface nodes (glowing dots at random points on the sphere).
  function randSpherePoint(radius) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
  }

  const NODE_COUNT = 90;
  const nodePos = new Float32Array(NODE_COUNT * 3);
  const nodeSeed = new Float32Array(NODE_COUNT);
  for (let i = 0; i < NODE_COUNT; i++) {
    const v = randSpherePoint(GLOBE_R * 1.002);
    nodePos[i * 3] = v.x;
    nodePos[i * 3 + 1] = v.y;
    nodePos[i * 3 + 2] = v.z;
    nodeSeed[i] = Math.random();
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(nodeSeed, 1));
  const nodeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: PR } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPixelRatio;
      varying float vP;
      void main() {
        vP = 0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 30.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (4.0 + vP * 7.0) * uPixelRatio * (90.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying float vP;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r) * (0.4 + vP * 0.6);
        vec3 col = mix(vec3(0.1, 1.0, 0.4), vec3(0.6, 1.0, 1.0), vP);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  globe.add(nodes);

  // ---------------------------------------------------------------------------
  // Attack arcs — glowing beziers arcing over the globe with travelling pulses.
  // ---------------------------------------------------------------------------
  const arcs = [];
  const ARC_COUNT = 16;
  const pulseGeo = new THREE.SphereGeometry(0.16, 8, 8);

  function buildArc() {
    const a = randSpherePoint(GLOBE_R);
    const b = randSpherePoint(GLOBE_R);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = GLOBE_R * (1.25 + Math.random() * 0.7);
    mid.normalize().multiplyScalar(lift);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(48);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const color = Math.random() > 0.5 ? 0x39ff14 : 0x18e0ff;
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    globe.add(line);

    const pulseMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    globe.add(pulse);

    return {
      curve,
      line,
      mat,
      pulse,
      pulseMat,
      t0: Math.random() * 10,
      dur: 2.2 + Math.random() * 2.6,
      color,
    };
  }
  for (let i = 0; i < ARC_COUNT; i++) arcs.push(buildArc());

  // ---------------------------------------------------------------------------
  // Neon grid floor + starfield.
  // ---------------------------------------------------------------------------
  const grid = new THREE.GridHelper(280, 90, 0x39ff14, 0x0c5a18);
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  grid.material.blending = THREE.AdditiveBlending;
  grid.material.depthWrite = false;
  grid.position.y = -16;
  scene.add(grid);

  const STAR_COUNT = 700;
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPos[i * 3] = (Math.random() * 2 - 1) * 220;
    starPos[i * 3 + 1] = (Math.random() * 2 - 1) * 140;
    starPos[i * 3 + 2] = -60 - Math.random() * 260;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0x39ff14,
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(stars);

  // ---------------------------------------------------------------------------
  // Resize handling.
  // ---------------------------------------------------------------------------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Render loop.
  // ---------------------------------------------------------------------------
  const clock = new THREE.Clock();
  let shake = 0;
  const tmp = new THREE.Vector3();

  function triggerShake(amount) {
    shake = Math.min(shake + amount, 1.4);
  }
  // expose for the terminal driver
  window.__hxShake = triggerShake;

  function animate() {
    const t = clock.getElapsedTime();

    rainMat.uniforms.uTime.value = t;
    nodeMat.uniforms.uTime.value = t;

    globe.rotation.y = t * 0.18;
    globe.rotation.x = Math.sin(t * 0.12) * 0.12;

    // Animate arcs: fade in/out and travel a pulse along each curve.
    for (const arc of arcs) {
      const local = (t - arc.t0) % (arc.dur + 1.4);
      let k = 0;
      if (local >= 0 && local <= arc.dur) {
        k = Math.sin((local / arc.dur) * Math.PI); // 0..1..0
        const pt = arc.curve.getPoint(Math.min(local / arc.dur, 1));
        arc.pulse.position.copy(pt);
        arc.pulseMat.opacity = k;
        const s = 0.7 + k * 0.9;
        arc.pulse.scale.setScalar(s);
      } else {
        arc.pulseMat.opacity = 0;
      }
      arc.mat.opacity = 0.15 + k * 0.75;
    }

    stars.rotation.y = t * 0.01;
    grid.position.z = ((t * 4) % 6.2) - 3.1;

    // Camera drift + optional shake.
    const baseX = Math.sin(t * 0.13) * 4.5;
    const baseY = 7 + Math.sin(t * 0.21) * 1.6;
    let cx = baseX;
    let cy = baseY;
    let cz = 40 + Math.cos(t * 0.1) * 3.0;
    if (shake > 0.001) {
      cx += (Math.random() * 2 - 1) * shake;
      cy += (Math.random() * 2 - 1) * shake;
      cz += (Math.random() * 2 - 1) * shake * 0.5;
      shake *= 0.9;
    }
    camera.position.set(cx, cy, cz);
    tmp.set(0, 4.5, 0);
    camera.lookAt(tmp);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // ===========================================================================
  // Terminal driver — types out a fake intrusion sequence, loops forever.
  // ===========================================================================
  const term = document.getElementById('term');
  const banner = document.getElementById('banner');
  const bannerText = document.getElementById('banner-text');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const HEX = '0123456789abcdef';
  const hex = (n) =>
    Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('');
  const randIp = () =>
    `${randInt(11, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;

  const MAX_LINES = 80;
  let cursorEl = null;

  function trim() {
    while (term.childElementCount > MAX_LINES) {
      term.removeChild(term.firstChild);
    }
  }

  function addLine(cls) {
    const el = document.createElement('span');
    el.className = 'line' + (cls ? ' ' + cls : '');
    term.appendChild(el);
    trim();
    return el;
  }

  function attachCursor(el) {
    if (cursorEl && cursorEl.parentNode) cursorEl.parentNode.removeChild(cursorEl);
    cursorEl = document.createElement('span');
    cursorEl.className = 'cursor';
    cursorEl.textContent = '\u00A0';
    el.appendChild(cursorEl);
  }

  async function typeLine(text, cls, speed = 16) {
    const el = addLine(cls);
    const textNode = document.createTextNode('');
    el.appendChild(textNode);
    attachCursor(el);
    for (let i = 0; i < text.length; i++) {
      textNode.data += text[i];
      // small jitter to feel human
      if (text[i] !== ' ' || Math.random() > 0.6) {
        await sleep(speed * rand(0.5, 1.6));
      }
    }
    return el;
  }

  async function printLine(text, cls) {
    const el = addLine(cls);
    el.textContent = text;
    await sleep(rand(20, 70));
    return el;
  }

  async function progressBar(label, cls, duration) {
    const el = addLine(cls);
    const width = 24;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const frac = Math.min((performance.now() - start) / duration, 1);
        const filled = Math.round(frac * width);
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
        el.textContent = `${label} [${bar}] ${String(Math.round(frac * 100)).padStart(3)}%`;
        if (frac < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  async function showBanner(text, denied) {
    bannerText.textContent = text;
    bannerText.setAttribute('data-text', text);
    banner.classList.toggle('denied', !!denied);
    banner.classList.add('show', 'glitch');
    if (window.__hxShake) window.__hxShake(denied ? 0.6 : 1.2);
    await sleep(1700);
    banner.classList.remove('show', 'glitch');
    await sleep(300);
  }

  // ----- HUD stats -----
  const statIp = document.getElementById('stat-ip');
  const statPing = document.getElementById('stat-ping');
  const statNodes = document.getElementById('stat-nodes');
  const statEnc = document.getElementById('stat-enc');
  const ENC = ['AES-256', 'RSA-4096', 'CHACHA20', 'SHA-512', 'ECC-P521'];
  let targetIp = randIp();
  let nodeTally = 0;
  setInterval(() => {
    statPing.textContent = `${randInt(7, 240)}ms`;
    if (Math.random() > 0.7) statEnc.textContent = choice(ENC);
    if (Math.random() > 0.4) {
      nodeTally = (nodeTally + randInt(1, 9)) % 9999;
      statNodes.textContent = nodeTally;
    }
  }, 700);

  // ----- intrusion script -----
  const SERVICES = [
    'ssh', 'https', 'ftp-data', 'smtp', 'rpcbind', 'netbios-ssn',
    'microsoft-ds', 'mysql', 'rdp', 'vnc', 'redis', 'mongod', 'docker',
  ];

  async function portScan(host) {
    await typeLine(`nmap -sS -T4 -A ${host}`, 'prompt', 14);
    await printLine(`Starting Nmap 7.94 ( https://nmap.org )`, 'dim');
    await printLine(`Nmap scan report for ${host}`, 'info');
    await sleep(180);
    const n = randInt(4, 7);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let port;
      do {
        port = choice([21, 22, 25, 80, 110, 139, 443, 445, 1433, 3306, 3389, 5900, 6379, 8080, 27017]);
      } while (used.has(port));
      used.add(port);
      await printLine(
        `  ${String(port).padEnd(6)}/tcp  open   ${choice(SERVICES)}`,
        'ok'
      );
      await sleep(rand(60, 160));
    }
    await printLine(`  ${used.size} open ports — firewall: ${choice(['weak', 'misconfigured', 'bypassable'])}`, 'warn');
  }

  async function bruteforce() {
    await typeLine(`hydra -l root -P rockyou.txt ssh://${targetIp}`, 'prompt', 14);
    await progressBar('cracking', 'warn', rand(1400, 2200));
    await printLine(`[22][ssh] login: root  password: ${choice(['hunter2', 'tr0ub4dor', 'P@ssw0rd!', 'letmein123', '0verr1de'])}`, 'ok');
    await printLine(`credentials harvested ✓`, 'ok');
  }

  async function exploit() {
    const cve = `CVE-2024-${randInt(1000, 9999)}`;
    await typeLine(`msf6 > use exploit/multi/handler  # ${cve}`, 'prompt', 12);
    await printLine(`[*] payload => meterpreter/reverse_tcp`, 'dim');
    await printLine(`[*] injecting shellcode 0x${hex(8)}...`, 'info');
    await progressBar('payload  ', 'info', rand(1100, 1800));
    await printLine(`[+] Meterpreter session 1 opened`, 'ok');
  }

  async function decrypt() {
    await typeLine(`./decrypt --keyfile vault.key --bruteforce`, 'prompt', 14);
    for (let i = 0; i < 4; i++) {
      await printLine(`  key[${i}] 0x${hex(16)}`, 'dim');
      await sleep(rand(70, 160));
    }
    await progressBar('decrypt  ', 'info', rand(1200, 2000));
    await printLine(`vault.db unlocked — ${randInt(12, 980)} records exfiltrated`, 'ok');
  }

  async function exfil() {
    await typeLine(`scp -r /root/secrets.tar.gz ghost@${randIp()}:/dev/shm`, 'prompt', 12);
    await progressBar('uplink   ', 'ok', rand(1000, 1600));
    await printLine(`transfer complete — ${randInt(40, 999)}.${randInt(0, 9)}MB @ ${randInt(80, 940)}MB/s`, 'ok');
    await printLine(`scrubbing logs... wtmp btmp auth.log syslog`, 'warn');
    await printLine(`traces removed ✓`, 'dim');
  }

  async function runSequence() {
    term.innerHTML = '';
    targetIp = randIp();
    statIp.textContent = targetIp;
    statEnc.textContent = choice(ENC);

    await typeLine(`establishing covert tunnel via ${randInt(3, 9)} relays...`, 'info', 12);
    for (let i = 0; i < randInt(3, 6); i++) {
      await printLine(`  hop ${i + 1} -> ${randIp()}  [${choice(['TOR', 'VPN', 'PROXY', 'I2P'])}]`, 'dim');
      await sleep(rand(80, 200));
    }
    await printLine(`tunnel established — anonymity 100%`, 'ok');
    await sleep(300);

    await portScan(targetIp);
    await sleep(280);
    await bruteforce();
    await sleep(280);
    await exploit();
    await sleep(280);

    // Occasionally a denied/retry beat for drama.
    if (Math.random() < 0.32) {
      await typeLine(`sudo -i`, 'prompt', 18);
      await printLine(`[!] intrusion detection triggered — re-routing`, 'err');
      await showBanner('ACCESS DENIED', true);
      await typeLine(`./bypass_ids --stealth --polymorphic`, 'prompt', 14);
      await progressBar('evading  ', 'warn', rand(1000, 1600));
      await printLine(`IDS blinded ✓`, 'ok');
      await sleep(200);
    }

    await decrypt();
    await sleep(260);
    await exfil();
    await sleep(360);

    await printLine(`root access confirmed @ ${targetIp}`, 'ok');
    await showBanner('ACCESS GRANTED', false);

    await sleep(700);
    await runSequence();
  }

  // Kick everything off.
  runSequence();
})();
