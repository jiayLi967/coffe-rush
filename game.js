/*
 * COFFEE RUSH
 * -----------
 * A sleepy office worker needs coffee before the clock runs out.
 * Coffee pours from the machine (top right). Drag everyday objects from the
 * drawer to guide the stream into his open mouth (bottom left).
 *
 * The coffee is ~1000 tiny particles that each follow three local rules:
 *   1. GRAVITY   – fall down.
 *   2. PERSONAL SPACE – if neighbours are too close, push them apart.
 *   3. STICKINESS – if neighbours are a bit far, pull slightly together.
 * Streams, splashes, puddles, drips and overflowing mugs are not programmed;
 * they emerge from those rules plus bouncing off objects.
 */
(() => {
  'use strict';

  // ================================================================ world
  const VW = 1280, VH = 800;          // virtual resolution
  const FLOOR = 690;                  // floor line; drawer below it
  const SPOUT = { x: 1092, y: 168 };

  // ================================================================ fluid params
  const PR = 3.6;          // particle collision radius
  const HR = 14;           // interaction radius (how far a drop "feels" others)
  const REST = 2.0;        // preferred crowding
  const K = 0.22;          // push when too crowded
  const KN = 0.5;         // push when very close
  const GRAV = 0.3;
  const MAXV = 13;
  const FRICTION = 0.004;
  const MAXP = 1500;
  const ML_PER_DROP = 1;

  // ================================================================ canvas
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let scale = 1, ox = 0, oy = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * DPR);
    canvas.height = Math.round(innerHeight * DPR);
    scale = Math.min(innerWidth / VW, innerHeight / VH);
    ox = (innerWidth - VW * scale) / 2; oy = (innerHeight - VH * scale) / 2;
  }
  addEventListener('resize', resize); resize();
  const FONT = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", cursive';

  // ================================================================ sketchy drawing
  // seeded jitter, re-seeded every few frames → hand-drawn "line boil"
  let rs = 1;
  const srnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const jit = a => (srnd() * 2 - 1) * a;
  const INK = '#222';

  function sLine(x1, y1, x2, y2, j = 1.2) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    for (let pass = 0; pass < 2; pass++) {
      ctx.moveTo(x1 + jit(j), y1 + jit(j));
      ctx.quadraticCurveTo(mx + jit(j * 1.3), my + jit(j * 1.3), x2 + jit(j), y2 + jit(j));
    }
  }
  function sPoly(pts, closed = true, j = 1.2) {
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      sLine(a[0], a[1], b[0], b[1], j);
    }
  }
  function sRect(x, y, w, h, j) { sPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, j); }
  function sEllipse(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, j = 0.8) {
    const steps = Math.max(8, Math.ceil((a1 - a0) * Math.max(rx, ry) / 6));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * i / steps;
        const x = cx + Math.cos(a) * (rx + jit(j)), y = cy + Math.sin(a) * (ry + jit(j));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
  }
  const stroke = (w = 2, c = INK) => { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
  const fillWhite = path => { ctx.fillStyle = '#fff'; ctx.fill(path || undefined); };

  function text(str, x, y, size = 24, align = 'left', color = INK) {
    ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  // ================================================================ objects
  // segs: [x1,y1,x2,y2] in local coords (physics); hw/hh: half extents (picking)
  function arcSegs(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = a0 + (a1 - a0) * i / n, q = a0 + (a1 - a0) * (i + 1) / n;
      out.push([cx + Math.cos(p) * rx, cy + Math.sin(p) * ry, cx + Math.cos(q) * rx, cy + Math.sin(q) * ry]);
    }
    return out;
  }

  const DEFS = {
    keyboard: {
      name: 'Keyboard', tip: 'Long, but sticky keys slow the coffee down',
      thick: 14, friction: 0.06, hw: 120, hh: 12,
      segs: [[-114, 0, 114, 0]],
      draw() {
        ctx.fillStyle = '#fff'; ctx.fillRect(-118, -10, 236, 20);
        ctx.beginPath(); sRect(-118, -10, 236, 20, 0.8); stroke(2.2);
        ctx.beginPath();
        for (let r = 0; r < 2; r++) for (let c = 0; c < 14; c++) sRect(-110 + c * 15.6, -7 + r * 7, 11, 5, 0.3);
        stroke(1);
      }
    },
    banana: {
      name: 'Banana peel', tip: 'Slippery! Flings coffee like a ski jump',
      thick: 6, friction: 0, hw: 74, hh: 26,
      segs: arcSegs(0, -22, 70, 40, 0.2 * Math.PI, 0.8 * Math.PI, 9),
      draw() {
        ctx.beginPath();
        sEllipse(0, -22, 70, 40, 0.2 * Math.PI, 0.8 * Math.PI, 0.5);
        sEllipse(0, -22, 62, 29, 0.24 * Math.PI, 0.76 * Math.PI, 0.5);
        ctx.fillStyle = '#fff'; stroke(2.2);
        // floppy peel at the stem end + spots
        ctx.beginPath();
        sPoly([[-56, 1], [-74, -14], [-86, -6]], false, 0.6); sPoly([[-52, -3], [-62, -26], [-74, -28]], false, 0.6);
        sPoly([[56, 1], [64, -4], [62, -9]], false, 0.4);
        stroke(1.8);
        ctx.fillStyle = '#6b5a3a';
        for (const [x, y] of [[-20, 12], [8, 15], [30, 9]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      }
    },
    fan: {
      name: 'Desk fan', tip: 'Blows coffee the way it faces',
      kind: 'fan', thick: 6, hw: 32, hh: 48,
      segs: [[-6, -24, -6, 24], [10, 22, 10, 44], [-12, 46, 32, 46]],
      draw() {
        ctx.beginPath(); sEllipse(-6, 0, 9, 26, 0, Math.PI * 2, 0.5); stroke(2.2);           // grill (side view)
        ctx.beginPath();
        const sp = frame * 0.6;
        for (let k = 0; k < 3; k++) { const a = sp + k * 2.1; sLine(-6, 0, -6 + Math.cos(a) * 4, Math.sin(a) * 22, 0.3); }
        stroke(1.4);
        ctx.beginPath(); sRect(2, -10, 18, 20, 0.5); sLine(10, 10, 10, 44, 0.5); sEllipse(10, 46, 22, 4, 0, 7, 0.5);
        ctx.fillStyle = '#fff'; stroke(2);
      }
    },
    sponge: {
      name: 'Sponge', tip: 'Soaks up coffee, then drips it straight down',
      kind: 'sponge', thick: 4, hw: 40, hh: 20,
      segs: [[-38, -18, 38, -18], [38, -18, 38, 18], [38, 18, -38, 18], [-38, 18, -38, -18]],
      draw() {
        const f = this && this.store ? this.store / SPONGE_CAP : 0;
        ctx.fillStyle = '#fff'; ctx.fillRect(-38, -18, 76, 36);
        if (f > 0) { ctx.fillStyle = `rgba(122,78,46,${0.25 + 0.5 * f})`; ctx.fillRect(-38, 18 - 36 * f, 76, 36 * f); }
        ctx.beginPath(); sRect(-38, -18, 76, 36, 1); stroke(2.2);
        ctx.beginPath();
        for (const [x, y, r] of [[-24, -6, 4], [-8, 6, 3], [6, -8, 5], [22, 4, 3.5], [-28, 10, 2.5], [28, -10, 2.5], [10, 10, 2]]) sEllipse(x, y, r, r * 0.8, 0, 7, 0.3);
        stroke(1.2);
      }
    },
    mug: {
      name: 'Mug', tip: 'Fills up first, then overflows',
      thick: 5, hw: 34, hh: 38,
      segs: [[-30, -34, -30, 34], [-30, 34, 30, 34], [30, 34, 30, -34]],
      draw() {
        ctx.beginPath(); sPoly([[-30, -34], [-30, 34], [30, 34], [30, -34]], false, 0.8); stroke(2.4);
        ctx.beginPath(); sEllipse(30, 0, 16, 14, -Math.PI / 2, Math.PI / 2, 0.6); stroke(2);
        ctx.beginPath(); sEllipse(0, -34, 30, 4, 0, Math.PI * 2, 0.4); stroke(1.2);
      }
    },
  };
  const SPONGE_CAP = 160;
  const FAN_RANGE = 480, FAN_POWER = 0.75;

  // static obstacles per level
  const OBST = {
    shelf: (x, y, w, a = 0) => ({
      x, y, a, thick: 9, segs: [[-w / 2, 0, w / 2, 0]],
      draw() {
        ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -5, w, 10);
        ctx.beginPath(); sRect(-w / 2, -5, w, 10, 0.8); stroke(2.2);
        ctx.beginPath(); sPoly([[-w / 2 + 14, 5], [-w / 2 + 14, 22], [-w / 2 + 30, 5]], false, 0.5);
        sPoly([[w / 2 - 14, 5], [w / 2 - 14, 22], [w / 2 - 30, 5]], false, 0.5); stroke(1.4);
        // a few books standing on the shelf
        ctx.beginPath(); sRect(-w / 2 + 40, -38, 12, 33, 0.6); sRect(-w / 2 + 54, -32, 10, 27, 0.6);
        sPoly([[-w / 2 + 66, -5], [-w / 2 + 80, -34], [-w / 2 + 90, -30], [-w / 2 + 76, -5]], true, 0.6); stroke(1.6);
      },
      extraSegs: [[-w / 2 + 46, -38, -w / 2 + 46, -5], [-w / 2 + 59, -32, -w / 2 + 59, -5]],
    }),
    lamp: (x, y) => ({
      x, y, a: 0, thick: 5, segs: [[-46, 30, -18, 0], [-18, 0, 18, 0], [18, 0, 46, 30]],
      draw() {
        ctx.beginPath(); sLine(0, -y, 0, 0, 0.6); stroke(1.4);
        ctx.beginPath(); sPoly([[-18, 0], [18, 0], [46, 30], [-46, 30]], true, 0.8); ctx.fillStyle = '#fff'; ctx.fill(); stroke(2.2);
        ctx.beginPath(); sEllipse(0, 34, 8, 5, 0, Math.PI, 0.4); stroke(1.4);
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) sLine(i * 16, 46, i * 24, 62, 0.8);
        stroke(1, '#bbb');
      }
    }),
    cabinet: (x, y, w, h) => ({
      x, y, a: 0, thick: 6, segs: [[-w / 2, -h, w / 2, -h], [w / 2, -h, w / 2, 0], [-w / 2, 0, -w / 2, -h]],
      draw() {
        ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -h, w, h);
        ctx.beginPath(); sRect(-w / 2, -h, w, h, 0.9); stroke(2.4);
        const n = Math.max(2, Math.round(h / 70));
        ctx.beginPath();
        for (let i = 1; i < n; i++) sLine(-w / 2, -h + h * i / n, w / 2, -h + h * i / n, 0.6);
        for (let i = 0; i < n; i++) sLine(-12, -h + h * (i + 0.5) / n, 12, -h + h * (i + 0.5) / n, 0.4);
        stroke(1.6);
      }
    }),
    plant: (x) => ({
      x, y: FLOOR, a: 0, thick: 5, segs: [[-26, -50, -20, 0], [26, -50, 20, 0]],
      draw() {
        ctx.beginPath(); sPoly([[-26, -50], [26, -50], [20, 0], [-20, 0]], true, 0.8); ctx.fillStyle = '#fff'; ctx.fill(); stroke(2.2);
        ctx.beginPath();
        sPoly([[0, -50], [-18, -100], [-40, -120]], false, 0.8); sPoly([[0, -50], [14, -110], [8, -150]], false, 0.8);
        sPoly([[0, -50], [30, -90], [52, -100]], false, 0.8);
        sEllipse(-40, -120, 14, 7, 0, 7, 0.8); sEllipse(8, -152, 7, 14, 0, 7, 0.8); sEllipse(54, -102, 14, 7, 0, 7, 0.8);
        stroke(1.8);
      }
    }),
  };

  // ================================================================ levels
  const LEVELS = [
    { title: 'Monday, 9:01 AM', time: 60, goal: 400, inv: { keyboard: 1, fan: 1, sponge: 1 }, obst: [OBST.plant(690)] },
    { title: 'Wednesday, 2:30 PM', time: 55, goal: 450, inv: { banana: 1, fan: 1, sponge: 1, mug: 1 },
      obst: [OBST.lamp(720, 250), OBST.cabinet(560, FLOOR, 90, 170), OBST.shelf(980, 420, 170, 0)] },
    { title: 'Friday, 4:59 PM', time: 50, goal: 400, inv: { keyboard: 1, banana: 1, fan: 1, sponge: 1 },
      obst: [OBST.cabinet(905, FLOOR, 96, 410), OBST.lamp(640, 292), OBST.shelf(1150, 400, 150, 0.25), OBST.cabinet(330, 480, 70, 170)] },
  ];

  // worker geometry
  const HEAD = { x: 198, y: 455, r: 38, tilt: -1.05 };
  const localToWorld = (lx, ly, o) => {
    const c = Math.cos(o.tilt ?? o.a), s = Math.sin(o.tilt ?? o.a);
    return { x: o.x + lx * c - ly * s, y: o.y + lx * s + ly * c };
  };
  const MOUTH = localToWorld(38, 28, HEAD);
  const MOUTH_R = 24;
  const DESK_Y = 600;

  // ================================================================ state
  let levelIdx = 0, level = LEVELS[0];
  let items = [], inv = {}, statics = [];
  let state = 'build';           // build | pour | win | lose | done
  let timeLeft = 0, drunk = 0, wasted = 0, frame = 0, lastTs = 0, stateT = 0;
  let stains = [];
  let sel = null, drag = null;   // drag: {item, dx, dy, mode:'move'|'rotate'|'new'}
  let hoverBtn = null, hoverSlot = null, gulpT = 0, showHelp = true, started = false, titleT = 0;
  const BREW = 8;   // seconds before the machine pours on its own

  // particles (struct of arrays)
  let n = 0;
  const X = new Float32Array(MAXP), Y = new Float32Array(MAXP);
  const PX = new Float32Array(MAXP), PY = new Float32Array(MAXP);
  const VX = new Float32Array(MAXP), VY = new Float32Array(MAXP);

  function loadLevel(i, keepItems = false) {
    levelIdx = i; level = LEVELS[i];
    if (!keepItems) {
      items = []; inv = { ...level.inv }; sel = null;
    }
    statics = level.obst.map(o => ({ ...o, world: null }));
    statics.forEach(updateWorld);
    n = 0; drunk = 0; wasted = 0; stains = []; timeLeft = level.time; started = false; titleT = 150;
    for (const it of items) it.store = 0;
    state = 'build'; stateT = 0;
  }

  function updateWorld(o) {
    const c = Math.cos(o.a), s = Math.sin(o.a);
    const segs = [...o.segs, ...(o.extraSegs || [])];
    const th = o.thick ?? DEFS[o.type].thick;
    const fr = o.friction ?? FRICTION;
    o.world = segs.map(([x1, y1, x2, y2]) => [
      o.x + x1 * c - y1 * s, o.y + x1 * s + y1 * c,
      o.x + x2 * c - y2 * s, o.y + x2 * s + y2 * c, th, fr]);
  }

  function addItem(type, x, y) {
    const d = DEFS[type];
    const it = { type, x, y, a: 0, segs: d.segs, thick: d.thick, friction: d.friction, kind: d.kind, store: 0, world: null };
    updateWorld(it); items.push(it); return it;
  }

  // ================================================================ physics
  const GW = Math.ceil(VW / HR) + 2, GH = Math.ceil(VH / HR) + 2;
  const ghead = new Int32Array(GW * GH);
  const gnext = new Int32Array(MAXP);
  const nbJ = new Int32Array(64), nbQ = new Float32Array(64), nbX = new Float32Array(64), nbY = new Float32Array(64);

  function emit() {
    if (n >= MAXP - 4) return;
    const k = 2 + (Math.random() < 0.15 ? 1 : 0);
    for (let i = 0; i < k && n < MAXP; i++) {
      X[n] = SPOUT.x + (Math.random() - 0.5) * 6; Y[n] = SPOUT.y + (Math.random() - 0.5) * 6;
      VX[n] = -1.3 + (Math.random() - 0.5) * 0.4; VY[n] = 1.6 + Math.random() * 0.4;
      PX[n] = X[n] - VX[n]; PY[n] = Y[n] - VY[n];
      n++;
    }
  }

  function spawn(x, y, vx, vy) {
    if (n >= MAXP) return;
    X[n] = x; Y[n] = y; VX[n] = vx; VY[n] = vy; PX[n] = x - vx; PY[n] = y - vy; n++;
  }

  function removeP(i) {
    n--; X[i] = X[n]; Y[i] = Y[n]; PX[i] = PX[n]; PY[i] = PY[n]; VX[i] = VX[n]; VY[i] = VY[n];
  }

  function collideSeg(i, x1, y1, x2, y2, th, fr) {
    const rad = th / 2 + PR;
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-6;
    let t = ((X[i] - x1) * dx + (Y[i] - y1) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const ex = X[i] - cx, ey = Y[i] - cy, d2 = ex * ex + ey * ey;
    if (d2 >= rad * rad) return;
    const d = Math.sqrt(d2) || 1e-4;
    let nx = ex / d, ny = ey / d;
    if (d2 < 1e-8) { nx = -dy / Math.sqrt(L2); ny = dx / Math.sqrt(L2); }
    X[i] = cx + nx * rad; Y[i] = cy + ny * rad;
    // keep sliding along the surface, kill motion into it
    let vx = X[i] - PX[i], vy = Y[i] - PY[i];
    const vn = vx * nx + vy * ny;
    let tx = vx - vn * nx, ty = vy - vn * ny;
    tx *= 1 - fr; ty *= 1 - fr;
    const out = vn > 0 ? vn : -vn * 0.08;   // tiny bounce
    PX[i] = X[i] - (tx + nx * out); PY[i] = Y[i] - (ty + ny * out);
  }

  function collideCircle(i, cx, cy, r) {
    const ex = X[i] - cx, ey = Y[i] - cy, d2 = ex * ex + ey * ey, rad = r + PR;
    if (d2 >= rad * rad) return;
    const d = Math.sqrt(d2) || 1e-4, nx = ex / d, ny = ey / d;
    X[i] = cx + nx * rad; Y[i] = cy + ny * rad;
    const vx = X[i] - PX[i], vy = Y[i] - PY[i], vn = vx * nx + vy * ny;
    const tx = (vx - vn * nx) * 0.9, ty = (vy - vn * ny) * 0.9, out = vn > 0 ? vn : 0;
    PX[i] = X[i] - (tx + nx * out); PY[i] = Y[i] - (ty + ny * out);
  }

  function step() {
    // fans push drops inside their cone (an outside force, not a drop rule)
    const fans = [];
    for (const it of items) if (it.kind === 'fan') {
      const c = Math.cos(it.a), s = Math.sin(it.a);
      fans.push([it.x - 6 * c, it.y - 6 * s, -c, -s]);
    }
    // RULE 1: gravity + inertia (predict)
    for (let i = 0; i < n; i++) {
      VY[i] += GRAV;
      for (let f = 0; f < fans.length; f++) {
        const F = fans[f], rx = X[i] - F[0], ry = Y[i] - F[1];
        const along = rx * F[2] + ry * F[3];
        if (along <= 0 || along > FAN_RANGE) continue;
        const perp = Math.abs(rx * F[3] - ry * F[2]);
        if (perp > 26 + along * 0.22) continue;
        const p = FAN_POWER * (1 - along / FAN_RANGE);
        VX[i] += F[2] * p; VY[i] += F[3] * p;
      }
      PX[i] = X[i]; PY[i] = Y[i];
      X[i] += VX[i]; Y[i] += VY[i];
    }
    // neighbour grid
    ghead.fill(-1);
    for (let i = 0; i < n; i++) {
      let gx = (X[i] / HR | 0) + 1, gy = (Y[i] / HR | 0) + 1;
      gx = gx < 0 ? 0 : gx >= GW ? GW - 1 : gx; gy = gy < 0 ? 0 : gy >= GH ? GH - 1 : gy;
      const k = gy * GW + gx; gnext[i] = ghead[k]; ghead[k] = i;
    }
    // RULES 2 + 3: personal space & stickiness (double density relaxation)
    for (let i = 0; i < n; i++) {
      let rho = 0, rhoN = 0, m = 0;
      let gx = (X[i] / HR | 0) + 1, gy = (Y[i] / HR | 0) + 1;
      for (let yy = gy - 1; yy <= gy + 1; yy++) {
        if (yy < 0 || yy >= GH) continue;
        for (let xx = gx - 1; xx <= gx + 1; xx++) {
          if (xx < 0 || xx >= GW) continue;
          for (let j = ghead[yy * GW + xx]; j !== -1; j = gnext[j]) {
            if (j === i) continue;
            const dx = X[j] - X[i], dy = Y[j] - Y[i], d2 = dx * dx + dy * dy;
            if (d2 >= HR * HR || m >= 64) continue;
            const d = Math.sqrt(d2) || 1e-4, q = 1 - d / HR;
            rho += q * q; rhoN += q * q * q;
            nbJ[m] = j; nbQ[m] = q; nbX[m] = dx / d; nbY[m] = dy / d; m++;
          }
        }
      }
      const P = K * (rho - REST), PN = KN * rhoN;   // P<0 → gentle pull (stickiness)
      let ax = 0, ay = 0;
      for (let k = 0; k < m; k++) {
        const q = nbQ[k], D = (P * q + PN * q * q) * 0.5;
        const j = nbJ[k];
        X[j] += D * nbX[k]; Y[j] += D * nbY[k];
        ax -= D * nbX[k]; ay -= D * nbY[k];
      }
      X[i] += ax; Y[i] += ay;
    }
    // collisions with the world
    const all = [];
    for (const o of statics) for (const s of o.world) all.push(s);
    for (const o of items) for (const s of o.world) all.push(s);
    const sponges = items.filter(it => it.kind === 'sponge');
    for (let i = 0; i < n; i++) {
      // the mouth comes first: a drop that reaches it is swallowed
      const mx = X[i] - MOUTH.x, my = Y[i] - MOUTH.y;
      if (mx * mx + my * my < MOUTH_R * MOUTH_R) { drunk++; gulpT = 10; removeP(i); i--; continue; }
      let soaked = false;
      for (const it of sponges) {
        if (it.store >= SPONGE_CAP) continue;
        const c = Math.cos(-it.a), s = Math.sin(-it.a), rx = X[i] - it.x, ry = Y[i] - it.y;
        const lx = rx * c - ry * s, ly = rx * s + ry * c;
        if (Math.abs(lx) < 38 + PR + 1 && Math.abs(ly) < 18 + PR + 1) { it.store++; soaked = true; break; }
      }
      if (soaked) { removeP(i); i--; continue; }
      for (let k = 0; k < all.length; k++) {
        const s = all[k];
        // cheap bounding test
        const r = s[4] / 2 + PR;
        if (X[i] < Math.min(s[0], s[2]) - r || X[i] > Math.max(s[0], s[2]) + r ||
            Y[i] < Math.min(s[1], s[3]) - r || Y[i] > Math.max(s[1], s[3]) + r) continue;
        collideSeg(i, s[0], s[1], s[2], s[3], s[4], s[5]);
      }
      collideCircle(i, HEAD.x, HEAD.y, HEAD.r);
      // side walls
      if (X[i] < PR) { X[i] = PR; PX[i] = X[i] + (X[i] - PX[i]) * 0.2; }
      if (X[i] > VW - PR) { X[i] = VW - PR; PX[i] = X[i] + (X[i] - PX[i]) * 0.2; }
    }
    // velocities from positions; floor = wasted coffee
    for (let i = 0; i < n; i++) {
      let vx = X[i] - PX[i], vy = Y[i] - PY[i];
      const sp = Math.hypot(vx, vy);
      if (sp > MAXV) { vx *= MAXV / sp; vy *= MAXV / sp; }
      VX[i] = vx * 0.998; VY[i] = vy * 0.998;
      if (Y[i] > FLOOR - PR) { wasted++; addStain(X[i], FLOOR); removeP(i); i--; }
      else if (X[i] > 40 && X[i] < 430 && Y[i] > DESK_Y - 8 - PR && Y[i] < DESK_Y + 12) { wasted++; addStain(X[i], DESK_Y - 6); removeP(i); i--; }
    }
    // sponges release what they soaked up, one drop at a time, from their bottom edge
    for (const it of sponges) {
      if (it.store <= 0 || n >= MAXP) continue;
      if (frame % 2) continue;
      const c = Math.cos(it.a), s = Math.sin(it.a), lx = (Math.random() - 0.5) * 16, ly = 18 + PR + 5;
      spawn(it.x + lx * c - ly * s, it.y + lx * s + ly * c, -s * 1.5, c * 1.5);
      it.store--;
    }
  }

  function addStain(x, y) {
    for (const s of stains) if (s.y === y && Math.abs(s.x - x) < s.r + 6) { s.r = Math.min(70, s.r + 0.25); s.x += (x - s.x) * 0.02; return; }
    stains.push({ x, y, r: 6 });
  }

  // ================================================================ drawing
  function drawRoom() {
    // wall details (light grey)
    ctx.beginPath();
    sLine(0, FLOOR, VW, FLOOR, 1.2);
    stroke(2.4);
    ctx.beginPath();
    for (let x = 30; x < VW; x += 90) sLine(x, FLOOR + 4, x - 30, FLOOR + 8, 0.6);
    stroke(1, '#ccc');
    // window
    ctx.beginPath(); sRect(470, 70, 220, 150, 1); sLine(580, 70, 580, 220, 0.8); sLine(470, 145, 690, 145, 0.8); stroke(1.6, '#c8c8c8');
    ctx.beginPath(); sEllipse(520, 110, 22, 9, 0, 7, 1); sEllipse(545, 104, 18, 9, 0, 7, 1); stroke(1.2, '#d6d6d6');
    // calendar
    ctx.beginPath(); sRect(880, 80, 70, 80, 0.8); sLine(880, 100, 950, 100, 0.5); stroke(1.6, '#c8c8c8');
    text(level.title.split(',')[0].slice(0, 3).toUpperCase(), 915, 132, 26, 'center', '#bbb');
  }

  function drawClock() {
    const cx = 74, cy = 70, r = 40;
    ctx.beginPath(); sEllipse(cx, cy, r, r, 0, Math.PI * 2, 0.8); ctx.fillStyle = '#fff'; ctx.fill(); stroke(2.4);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sLine(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8), cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), 0.3); }
    stroke(1.4);
    // red sector = time remaining
    const frac = Math.max(0, timeLeft / level.time);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.closePath();
    ctx.fillStyle = frac < 0.25 ? 'rgba(220,60,40,0.35)' : 'rgba(220,60,40,0.15)'; ctx.fill();
    const a = -Math.PI / 2 + frac * Math.PI * 2;
    ctx.beginPath(); sLine(cx, cy, cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10), 0.5); stroke(2.6, '#d33');
    const secs = Math.ceil(timeLeft);
    if (secs <= 10 && state === 'pour') text(String(secs), cx, cy + r + 18, 24, 'center', '#d33');
  }

  function drawMachine() {
    // coffee machine mounted top right
    ctx.fillStyle = '#fff';
    ctx.beginPath(); sRect(1110, 24, 150, 118, 1); ctx.fillRect(1110, 24, 150, 118); stroke(2.6);
    ctx.beginPath(); sRect(1128, 40, 70, 34, 0.6); stroke(1.6);
    const brewLeft = Math.ceil(BREW - (level.time - timeLeft));
    if (state === 'build') {
      if (hoverBtn === 'pour') { ctx.fillStyle = '#f7e9db'; ctx.fillRect(1131, 43, 64, 28); }
      text(started ? String(brewLeft) : '▶', 1163, 58, started ? 24 : 18, 'center', '#8a5a35');
    } else if (state === 'pour') {
      ctx.fillStyle = '#8a5a35'; ctx.fillRect(1136, 54, 54 * Math.max(0, timeLeft / level.time), 6);
    }
    ctx.beginPath(); sEllipse(1230, 56, 10, 10, 0, 7, 0.5); sEllipse(1230, 96, 7, 7, 0, 7, 0.5); stroke(1.6);
    // nozzle
    ctx.beginPath(); sPoly([[1110, 112], [1092, 130], [1088, 156], [1100, 156], [1104, 134], [1112, 128]], false, 0.6); stroke(2.4);
    if (state === 'pour' && frame % 20 < 10) {
      ctx.beginPath(); sEllipse(1066, 132, 10, 5, 0, 7, 1); stroke(1, '#bbb');
    }
    // steam
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = 1150 + i * 22, w = Math.sin(frame * 0.05 + i) * 4;
      ctx.moveTo(x, 18); ctx.bezierCurveTo(x + 8 + w, 8, x - 8 - w, 0, x + w, -10);
    }
    stroke(1.4, '#ccc');
  }

  function drawWorker() {
    const pour = state === 'pour';
    const pct = Math.min(1, drunk * ML_PER_DROP / level.goal);
    const t = frame;
    // chair back
    ctx.beginPath(); sPoly([[92, 470], [86, 640], [96, 690]], false, 1); sLine(86, 640, 170, 640, 1); sLine(160, 640, 150, 690, 1); stroke(2.2);
    // body
    ctx.beginPath(); sPoly([[150, 600], [158, 520], [182, 500], [212, 506], [228, 530], [222, 600]], true, 1);
    ctx.fillStyle = '#fff'; ctx.fill(); stroke(2.4);
    // tie
    ctx.beginPath(); sPoly([[198, 506], [206, 520], [200, 572], [192, 560], [196, 520]], true, 0.6); stroke(1.8);
    // arms reaching up, waving ("feed me!")
    const wave = state === 'win' ? 0 : Math.sin(t * (pour ? 0.25 : 0.08)) * (pour ? 10 : 4);
    const raise = state === 'lose' ? 60 : 0;
    ctx.beginPath();
    sPoly([[164, 520], [128, 470 + raise], [112 + wave, 404 + raise * 1.5]], false, 1);
    sPoly([[220, 524], [262, 486 + raise], [292 - wave, 418 + raise * 1.5]], false, 1);
    stroke(2.6);
    ctx.beginPath(); sEllipse(112 + wave, 398 + raise * 1.5, 9, 9, 0, 7, 0.6); sEllipse(292 - wave, 412 + raise * 1.5, 9, 9, 0, 7, 0.6);
    ctx.fillStyle = '#fff'; ctx.fill(); stroke(2);
    // neck
    ctx.beginPath(); sLine(190, 488, 188, 504, 0.5); sLine(206, 486, 206, 504, 0.5); stroke(2);

    // head (profile, tilted way back, mouth wide open)
    ctx.save();
    ctx.translate(HEAD.x, HEAD.y);
    const nod = state === 'lose' ? 1.25 : 0;
    ctx.rotate(HEAD.tilt + nod);
    const closed = state === 'lose';
    const jaw = closed ? 0 : (gulpT > 0 ? 0.55 : 1 + Math.sin(t * 0.25) * (pour ? 0.08 : 0.03));
    const lowLip = [46 - 12 * jaw, 14 + 30 * jaw], chin = [40 - 12 * jaw, 22 + 30 * jaw];
    const outline = [];
    for (let i = 0; i <= 18; i++) { const a = -0.35 - i * (3.95 / 18); outline.push([Math.cos(a) * HEAD.r, Math.sin(a) * HEAD.r]); }
    outline.push([4, 40], [chin[0] - 10, chin[1] + 2], chin, lowLip, [46, 14], [45, 8], [55, 1], [41, -9]);
    ctx.beginPath(); sPoly(outline, true, 0.7); ctx.fillStyle = '#fff'; ctx.fill(); stroke(2.4);
    // mouth cavity
    ctx.beginPath(); ctx.moveTo(46, 14); ctx.quadraticCurveTo(26, 14 + 12 * jaw, lowLip[0], lowLip[1]); ctx.closePath();
    ctx.fillStyle = '#3a2418'; ctx.fill(); stroke(2);
    if (jaw > 0.3) { ctx.fillStyle = '#fff'; ctx.fillRect(38, 14, 7, 4); }
    // hair: messy scribbles at the back
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.45 - i * 0.2, r0 = HEAD.r - 3;
      sLine(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a - 0.15) * (r0 + 11 + jit(3)), Math.sin(a - 0.15) * (r0 + 11 + jit(3)), 1);
    }
    stroke(2);
    // ear
    ctx.beginPath(); sEllipse(-4, 6, 7, 10, 0, 7, 0.5); sEllipse(-4, 6, 3, 5, 0, 4, 0.4); stroke(1.8);
    // eye
    const awake = state === 'win' ? 1 : pct;
    ctx.beginPath();
    if (closed) {
      sLine(20, -16, 32, -8, 0.4); sLine(20, -8, 32, -16, 0.4); stroke(2);
    } else if (awake < 0.35) {
      sEllipse(26, -12, 7, 4, 0, Math.PI, 0.3); stroke(2);                       // droopy lid
      ctx.beginPath(); sEllipse(26, -5, 7, 3, 0.2, Math.PI - 0.2, 0.4); stroke(1.2, '#888'); // eye bag
    } else {
      const r = 4 + awake * 4;
      sEllipse(26, -12, r, r, 0, 7, 0.4); ctx.fillStyle = '#fff'; ctx.fill(); stroke(2);
      ctx.beginPath(); ctx.arc(28, -12, 1.8 + awake * 1.4, 0, 7); ctx.fillStyle = INK; ctx.fill();
    }
    // eyebrow
    ctx.beginPath(); sLine(17, -24 - awake * 5, 33, -22 - awake * 7, 0.5); stroke(2.2);
    ctx.restore();
    if (gulpT > 6) text('gulp!', MOUTH.x + 34, MOUTH.y - 26, 20, 'center', '#8a5a35');

    // "zzz" / "!!!"
    if (state === 'build' || state === 'lose') {
      const zz = (t * 0.6) % 60;
      text('z', 150, 400 - zz, 18 + zz * 0.2, 'center', `rgba(0,0,0,${1 - zz / 60})`);
      text('Z', 130, 380 - zz * 0.8, 14 + zz * 0.3, 'center', `rgba(0,0,0,${0.7 - zz / 90})`);
    }
    if (state === 'win') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * 0.25; sLine(200 + Math.cos(a) * 64, 452 + Math.sin(a) * 64, 200 + Math.cos(a) * 84, 452 + Math.sin(a) * 84, 1); }
      stroke(2.4);
    }
    if (state === 'build') {
      ctx.save(); ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(MOUTH.x, MOUTH.y, MOUTH_R + 6, 0, Math.PI * 2); stroke(1.4, '#c08a5c');
      ctx.restore();
    }

    // desk + laptop (drawn over the body)
    ctx.fillStyle = '#fff'; ctx.fillRect(40, DESK_Y - 6, 390, 12);
    ctx.beginPath(); sRect(40, DESK_Y - 6, 390, 12, 0.8); sLine(60, DESK_Y + 6, 60, FLOOR, 0.8); sLine(410, DESK_Y + 6, 410, FLOOR, 0.8);
    sRect(300, DESK_Y + 6, 100, 50, 0.8); sLine(330, DESK_Y + 31, 370, DESK_Y + 31, 0.5);
    stroke(2.4);
    ctx.beginPath(); sPoly([[300, DESK_Y - 6], [342, DESK_Y - 6], [364, DESK_Y - 68], [358, DESK_Y - 72], [336, DESK_Y - 10]], false, 0.6); stroke(2.2);
    // little papers
    ctx.beginPath(); sPoly([[60, DESK_Y - 6], [64, DESK_Y - 14], [130, DESK_Y - 16], [128, DESK_Y - 6]], false, 0.6); stroke(1.4);

    // caffeine meter (a mug that fills)
    const mx = 140, my = 34, mw = 50, mh = 64;
    ctx.fillStyle = '#c99d74';
    ctx.fillRect(mx + 3, my + mh - (mh - 6) * pct - 3, mw - 6, (mh - 6) * pct);
    ctx.beginPath(); sPoly([[mx, my], [mx, my + mh], [mx + mw, my + mh], [mx + mw, my]], false, 0.8); stroke(2.4);
    ctx.beginPath(); sEllipse(mx + mw, my + mh / 2, 14, 16, -Math.PI / 2, Math.PI / 2, 0.5); stroke(2);
    text(`${Math.min(drunk * ML_PER_DROP, level.goal)}/${level.goal}`, mx + mw / 2 + 6, my + mh + 18, 18, 'center', '#777');
  }

  function drawStains() {
    for (const s of stains) {
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, s.r + 4, Math.min(8, 2 + s.r * 0.18), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(110,68,38,0.28)'; ctx.fill();
      ctx.beginPath(); sEllipse(s.x, s.y + 2, s.r + 4, Math.min(8, 2 + s.r * 0.18), 0, Math.PI * 2, 0.6); stroke(1, 'rgba(90,55,32,.6)');
    }
  }

  // coffee: soft blobs → threshold → liquid with an ink outline
  const LS = 0.5;                                   // liquid layer resolution
  const liq = document.createElement('canvas'); liq.width = VW * LS; liq.height = VH * LS;
  const lctx = liq.getContext('2d', { willReadFrequently: true });
  const blob = document.createElement('canvas'); const BR = 7; blob.width = blob.height = BR * 2;
  {
    const b = blob.getContext('2d'), g = b.createRadialGradient(BR, BR, 0, BR, BR, BR);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.5, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = g; b.fillRect(0, 0, BR * 2, BR * 2);
  }
  function drawCoffee() {
    if (!n) return;
    lctx.clearRect(0, 0, liq.width, liq.height);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) {
      const x = X[i] * LS, y = Y[i] * LS;
      lctx.drawImage(blob, x - BR, y - BR);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.max(0, (x0 - BR - 1) | 0); y0 = Math.max(0, (y0 - BR - 1) | 0);
    x1 = Math.min(liq.width, (x1 + BR + 2) | 0); y1 = Math.min(liq.height, (y1 + BR + 2) | 0);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const img = lctx.getImageData(x0, y0, w, h), d = img.data;
    for (let k = 0; k < d.length; k += 4) {
      const a = d[k + 3];
      if (a > 128) { d[k] = 122; d[k + 1] = 78; d[k + 2] = 46; d[k + 3] = 255; }          // coffee
      else if (a > 62) { d[k] = 40; d[k + 1] = 26; d[k + 2] = 18; d[k + 3] = 255; }       // ink rim
      else d[k + 3] = 0;
    }
    lctx.putImageData(img, x0, y0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(liq, 0, 0, VW, VH);
  }

  function drawObj(o, def) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); def.draw.call(o); ctx.restore();
  }

  function rotHandle(it) {
    const d = DEFS[it.type];
    return localToWorld(0, -(d.hh + 26), it);
  }

  function drawItems() {
    for (const it of items) {
      const d = DEFS[it.type];
      if (it === sel) {
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.a);
        ctx.setLineDash([5, 6]); ctx.strokeStyle = '#999'; ctx.lineWidth = 1.2;
        ctx.strokeRect(-d.hw - 8, -d.hh - 8, d.hw * 2 + 16, d.hh * 2 + 16);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, -d.hh - 8); ctx.lineTo(0, -d.hh - 20); stroke(1.2, '#999');
        ctx.restore();
        const h = rotHandle(it);
        ctx.beginPath(); sEllipse(h.x, h.y, 8, 8, 0, 7, 0.4); ctx.fillStyle = '#fff'; ctx.fill(); stroke(1.8);
        ctx.beginPath(); ctx.arc(h.x, h.y, 3.5, -2.4, 1.2); stroke(1.4);
      }
      if (it.kind === 'fan') {
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.a);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ph = ((frame * 3 + k * 57) % FAN_RANGE), off = ((k * 37) % 5 - 2) * (8 + ph * 0.09);
          sLine(-14 - ph, off, -40 - ph, off, 0.4);
        }
        stroke(1.2, 'rgba(160,160,160,0.6)');
        ctx.restore();
      }
      drawObj(it, d);
    }
  }

  // ---------------------------------------------------------------- drawer & buttons
  const SLOT_W = 110, SLOT_Y = FLOOR + 16, SLOT_H = 76;
  function slots() {
    const keys = Object.keys(level.inv);
    const total = keys.length * SLOT_W + (keys.length - 1) * 12;
    let x = (VW - total) / 2;
    return keys.map(k => { const s = { type: k, x, y: SLOT_Y, w: SLOT_W, h: SLOT_H }; x += SLOT_W + 12; return s; });
  }

  function drawDrawer() {
    for (const s of slots()) {
      const c = inv[s.type] || 0;
      ctx.beginPath(); sRect(s.x, s.y, s.w, s.h, 0.8); stroke(1.8, c ? INK : '#ccc');
      ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
      const d = DEFS[s.type], sc = Math.min(0.62, (s.w - 24) / (d.hw * 2), 52 / (d.hh * 2));
      ctx.scale(sc, sc); ctx.globalAlpha = c ? 1 : 0.2; d.draw(); ctx.restore(); ctx.globalAlpha = 1;
      if (c > 1) text(`×${c}`, s.x + s.w - 14, s.y + 14, 16, 'center', '#888');
    }
  }

  let buttons = [];
  function button(id, label, x, y, w, h, primary) {
    buttons.push({ id, x, y, w, h });
    const hov = hoverBtn === id;
    if (primary) { ctx.fillStyle = hov ? '#f0dcc6' : '#f7e9db'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6); }
    ctx.beginPath(); sRect(x, y, w, h, hov ? 1.4 : 0.9); stroke(primary ? 2.6 : 2);
    text(label, x + w / 2, y + h / 2 + 1, primary ? 26 : 21, 'center');
  }

  function drawUI() {
    buttons = [];
    button('retry', '↻', 222, 36, 40, 40);
    button('clear', '✕', 270, 36, 40, 40);
    if (state === 'build') buttons.push({ id: 'pour', x: 1110, y: 24, w: 150, h: 118 });   // tap the machine to pour

    // hover tooltips
    if (hoverBtn === 'retry' || hoverBtn === 'clear')
      text(hoverBtn === 'retry' ? 'retry, keep layout' : 'clear the room', 222, 92, 16, 'left', '#999');
    if (hoverSlot && !drag) {
      const sl = slots().find(q => q.type === hoverSlot), d = DEFS[hoverSlot];
      ctx.font = `18px ${FONT}`; const w = Math.max(ctx.measureText(d.tip).width, ctx.measureText(d.name).width) + 24;
      const x = Math.max(8, Math.min(VW - w - 8, sl.x + sl.w / 2 - w / 2)), y = sl.y - 66;
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, 54);
      ctx.beginPath(); sRect(x, y, w, 54, 0.8); stroke(1.4, '#999');
      text(d.name, x + 12, y + 16, 19, 'left'); text(d.tip, x + 12, y + 38, 16, 'left', '#777');
    }
    // first-visit hint, one quiet line
    if (showHelp && state === 'build' && !hoverSlot)
      text('drag things into the room  ·  turn them with the ○  ·  tap the machine to pour', VW / 2, SLOT_Y - 16, 17, 'center', '#aaa');

    // level card, fades out
    if (state === 'build' && !started && titleT > 0) {
      const a = Math.min(1, titleT / 40);
      const [day, time] = level.title.split(', ');
      text(day, VW / 2, 330, 64, 'center', `rgba(34,34,34,${a})`);
      text(time, VW / 2, 384, 28, 'center', `rgba(120,120,120,${a})`);
    }

    if (state === 'win' || state === 'lose' || state === 'done') {
      const a = Math.min(1, stateT / 20);
      ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`; ctx.fillRect(0, 0, VW, VH);
      const w = 400, h = 190, x = (VW - w) / 2, y = 230;
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
      ctx.beginPath(); sRect(x, y, w, h, 1.4); stroke(2.6);
      if (state === 'win') {
        text('AWAKE!', VW / 2, y + 60, 56, 'center');
        button('again', '↻', VW / 2 - 110, y + 112, 60, 50);
        button('next', levelIdx < LEVELS.length - 1 ? 'Next →' : 'Finish →', VW / 2 - 30, y + 112, 140, 50, true);
      } else if (state === 'lose') {
        text('zzz…', VW / 2, y + 60, 56, 'center');
        button('again', 'Try again', VW / 2 - 80, y + 112, 160, 50, true);
      } else {
        text('Weekend!', VW / 2, y + 60, 56, 'center');
        button('restart', 'Play again', VW / 2 - 80, y + 112, 160, 50, true);
      }
    }
  }

  // ================================================================ main loop
  function tick(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
    lastTs = ts;
    frame++; stateT++; if (titleT > 0) titleT--;
    if (gulpT > 0) gulpT--;

    if (state === 'build' && started) {
      timeLeft -= dt;
      if (level.time - timeLeft >= BREW) { state = 'pour'; stateT = 0; showHelp = false; }
    }
    if (state === 'pour') {
      emit();
      timeLeft -= dt;
      if (drunk * ML_PER_DROP >= level.goal) { state = 'win'; stateT = 0; }
      else if (timeLeft <= 0) { timeLeft = 0; state = 'lose'; stateT = 0; }
    }
    if (state !== 'build') step();   // coffee keeps flowing a moment after win / lose

    // ---- draw
    rs = 1 + ((frame / 9 | 0) % 5) * 7919;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * ox, DPR * oy);

    drawRoom();
    drawClock();
    for (const o of statics) drawObj(o, o);
    drawWorker();
    drawStains();
    drawMachine();
    drawCoffee();
    drawItems();
    drawDrawer();
    drawUI();
    if (innerHeight > innerWidth * 1.1) {          // portrait phone hint
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#888';
      ctx.fillText('Turn your phone sideways for a bigger office ↻', innerWidth / 2, oy - 24);
    }
    requestAnimationFrame(tick);
  }

  // ================================================================ input
  const toV = e => ({ x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale });
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function pickItem(p) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i], d = DEFS[it.type];
      const c = Math.cos(-it.a), s = Math.sin(-it.a);
      const lx = (p.x - it.x) * c - (p.y - it.y) * s, ly = (p.x - it.x) * s + (p.y - it.y) * c;
      if (Math.abs(lx) < d.hw + 6 && Math.abs(ly) < d.hh + 8) return it;
    }
    return null;
  }

  function onButton(id) {
    if (id === 'pour') { state = 'pour'; stateT = 0; showHelp = false; started = true; }
    else if (id === 'retry' || id === 'again') loadLevel(levelIdx, true);
    else if (id === 'clear') loadLevel(levelIdx, false);
    else if (id === 'next') {
      if (levelIdx < LEVELS.length - 1) loadLevel(levelIdx + 1);
      else { state = 'done'; stateT = 0; }
    } else if (id === 'restart') loadLevel(0);
  }

  canvas.addEventListener('pointerdown', e => {
    const p = toV(e);
    canvas.setPointerCapture(e.pointerId);
    const b = buttons.find(b => inRect(p, b));
    if (b) { onButton(b.id); return; }
    if (state === 'win' || state === 'lose' || state === 'done') return;
    // rotation handle
    if (sel) {
      const h = rotHandle(sel);
      if (Math.hypot(p.x - h.x, p.y - h.y) < 16) { drag = { item: sel, mode: 'rotate' }; return; }
    }
    // drawer
    for (const s of slots()) {
      if (inRect(p, s) && (inv[s.type] || 0) > 0) {
        inv[s.type]--; started = true; showHelp = false;
        const it = addItem(s.type, p.x, p.y);
        sel = it; drag = { item: it, dx: 0, dy: 0, mode: 'move' };
        return;
      }
    }
    const it = pickItem(p);
    if (it) {
      sel = it; items.splice(items.indexOf(it), 1); items.push(it);
      drag = { item: it, dx: it.x - p.x, dy: it.y - p.y, mode: 'move' };
    } else sel = null;
  });

  canvas.addEventListener('pointermove', e => {
    const p = toV(e);
    const b = buttons.find(b => inRect(p, b));
    hoverBtn = b ? b.id : null;
    const hs = slots().find(q => inRect(p, q));
    hoverSlot = hs && (inv[hs.type] || 0) > 0 ? hs.type : null;
    canvas.style.cursor = b ? 'pointer' : drag ? 'grabbing' : (pickItem(p) || slots().some(s => inRect(p, s))) ? 'grab' : 'default';
    if (!drag) return;
    const it = drag.item;
    if (drag.mode === 'move') {
      it.x = Math.max(0, Math.min(VW, p.x + drag.dx));
      it.y = Math.max(0, Math.min(VH, p.y + drag.dy));
    } else {
      it.a = Math.atan2(p.y - it.y, p.x - it.x) + Math.PI / 2;
    }
    updateWorld(it);
  });

  addEventListener('pointerup', () => {
    if (drag && drag.mode === 'move') {
      const it = drag.item;
      // dropped back in the drawer → return it
      if (it.y > FLOOR + 6) {
        items.splice(items.indexOf(it), 1); inv[it.type]++; if (sel === it) sel = null;
      }
    }
    drag = null;
  });

  canvas.addEventListener('wheel', e => {
    const p = toV(e);
    const it = pickItem(p) || sel;
    if (!it) return;
    e.preventDefault();
    it.a += Math.sign(e.deltaY) * 0.1; sel = it; updateWorld(it);
  }, { passive: false });

  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (sel && (k === 'q' || k === 'arrowleft')) { sel.a -= 0.1; updateWorld(sel); }
    else if (sel && (k === 'e' || k === 'arrowright')) { sel.a += 0.1; updateWorld(sel); }
    else if (sel && (k === 'delete' || k === 'backspace')) {
      items.splice(items.indexOf(sel), 1); inv[sel.type]++; sel = null;
    } else if (k === ' ' && state === 'build') { e.preventDefault(); onButton('pour'); }
    else if (k === 'r') onButton('retry');
  });

  // hooks for testing / recording
  window.__coffee = {
    place(type, x, y, a = 0) { if (!inv[type]) return null; inv[type]--; const it = addItem(type, x, y); it.a = a; updateWorld(it); return it; },
    pour() { onButton('pour'); },
    level(i) { loadLevel(i); },
    setTime(t) { timeLeft = t; },
    win() { drunk = 99999; },
    get info() { return { state, drunk, wasted, n, timeLeft, level: levelIdx }; },
  };

  loadLevel(0);
  requestAnimationFrame(tick);
})();
