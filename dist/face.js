import { FACE_NAMES } from './visemes.js?v=3';

const BLINK_INTERVAL_MIN_MS = 2600;
const BLINK_INTERVAL_MAX_MS = 5400;

/**
 * Anatomical & stylistic anime mouth parameters for all 12 BMO visemes:
 * - open: vertical jaw/lip opening (0..1)
 * - width: horizontal mouth corner span (0.35..1.15)
 * - round: lip pucker / O-shape rounding (0..1)
 * - smile: corner curvature (-0.3..0.6)
 * - upperTeeth: visibility of upper teeth row (0..1)
 * - lowerTeeth: visibility of lower teeth row (0..1)
 * - tongue: tongue elevation & visibility (0..1)
 * - tongueTip: tongue tip touching alveolar ridge for L/D/N (0..1)
 * - lipBite: lower lip tucked under upper teeth for F/V (0..1)
 */
export const VISEME_SHAPES = {
  Neutral: {
    open: 0.02,
    width: 0.78,
    round: 0.05,
    smile: 0.28,
    upperTeeth: 0.0,
    lowerTeeth: 0.0,
    tongue: 0.0,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  M: {
    open: 0.0,
    width: 0.84,
    round: 0.02,
    smile: 0.18,
    upperTeeth: 0.0,
    lowerTeeth: 0.0,
    tongue: 0.0,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  A: {
    open: 0.92,
    width: 0.98,
    round: 0.12,
    smile: 0.24,
    upperTeeth: 0.85,
    lowerTeeth: 0.35,
    tongue: 0.78,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  D: {
    open: 0.42,
    width: 0.88,
    round: 0.08,
    smile: 0.2,
    upperTeeth: 0.88,
    lowerTeeth: 0.42,
    tongue: 0.55,
    tongueTip: 0.65,
    lipBite: 0.0,
  },
  E: {
    open: 0.5,
    width: 1.08,
    round: 0.0,
    smile: 0.42,
    upperTeeth: 0.92,
    lowerTeeth: 0.48,
    tongue: 0.52,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  F: {
    open: 0.22,
    width: 0.82,
    round: 0.1,
    smile: 0.12,
    upperTeeth: 0.95,
    lowerTeeth: 0.0,
    tongue: 0.15,
    tongueTip: 0.0,
    lipBite: 0.9,
  },
  L: {
    open: 0.58,
    width: 0.86,
    round: 0.1,
    smile: 0.22,
    upperTeeth: 0.82,
    lowerTeeth: 0.28,
    tongue: 0.85,
    tongueTip: 0.95,
    lipBite: 0.0,
  },
  Oh: {
    open: 0.86,
    width: 0.56,
    round: 0.92,
    smile: 0.0,
    upperTeeth: 0.45,
    lowerTeeth: 0.15,
    tongue: 0.62,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  R: {
    open: 0.46,
    width: 0.68,
    round: 0.55,
    smile: 0.1,
    upperTeeth: 0.72,
    lowerTeeth: 0.25,
    tongue: 0.68,
    tongueTip: 0.35,
    lipBite: 0.0,
  },
  S: {
    open: 0.26,
    width: 0.96,
    round: 0.04,
    smile: 0.3,
    upperTeeth: 0.96,
    lowerTeeth: 0.78,
    tongue: 0.25,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  Uh: {
    open: 0.62,
    width: 0.76,
    round: 0.32,
    smile: 0.14,
    upperTeeth: 0.68,
    lowerTeeth: 0.3,
    tongue: 0.64,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  Woo: {
    open: 0.52,
    width: 0.42,
    round: 1.0,
    smile: -0.05,
    upperTeeth: 0.18,
    lowerTeeth: 0.0,
    tongue: 0.38,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class BmoFaceController {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = new Map();
    this.currentViseme = 'Neutral';
    this.eyesOpen = true;
    this.blinkStep = 0; // 0 = open, 0.35 = 3/4, 0.75 = half, 1.0 = closed (4-step anime blink)
    this.targetBlink = 0;
    this.loaded = false;
    this.mood = 'happy'; // 'happy' | 'listening' | 'thinking' | 'talking'

    // Interpolated live mouth state for silky 60fps coarticulation
    this.mouthState = { ...VISEME_SHAPES.Neutral };
    this.targetMouth = { ...VISEME_SHAPES.Neutral };

    // Live eye gaze & head micro-motion
    this.gazeX = 0;
    this.gazeY = 0;
    this.targetGazeX = 0;
    this.targetGazeY = 0;
    this.lastPointerMoveAt = 0;

    this._blinkTimer = null;
    this._unblinkTimer = null;
    this._raf = null;
    this._lastFrameTime = performance.now();

    this._bindPointerTracking();
  }

  _bindPointerTracking() {
    if (typeof window === 'undefined') return;
    const onMove = (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = clamp((e.clientX - cx) / (rect.width * 0.65), -1, 1);
      const ny = clamp((e.clientY - cy) / (rect.height * 0.65), -1, 1);
      this.targetGazeX = nx;
      this.targetGazeY = ny;
      this.lastPointerMoveAt = performance.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
  }

  async loadSprites(basePath = './assets/face') {
    const names = [...FACE_NAMES, 'eyesopen', 'eyesclosed'];
    await Promise.all(
      names.map(
        (name) =>
          new Promise((resolve) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
              this.sprites.set(name, img);
              resolve(true);
            };
            img.onerror = () => resolve(false);
            img.src = `${basePath}/${name}.png`;
          })
      )
    );
    this.loaded = true;
    this.render(performance.now());
    this.startBlinking();
    this.startAnimationLoop();
  }

  setMood(mood) {
    this.mood = mood || 'happy';
  }

  setViseme(visemeName) {
    this.setFace(visemeName);
  }

  setFace(visemeName) {
    const target = FACE_NAMES.includes(visemeName) ? visemeName : 'Neutral';
    this.currentViseme = target;
    this.targetMouth = { ...(VISEME_SHAPES[target] || VISEME_SHAPES.Neutral) };
    if (this.canvas) {
      this.canvas.dataset.viseme = this.currentViseme;
    }
    if (typeof document !== 'undefined') {
      const badge = document.getElementById('bmo-viseme-badge');
      if (badge) badge.textContent = this.currentViseme;
    }
  }

  setEyes(open) {
    const next = Boolean(open);
    this.eyesOpen = next;
    this.targetBlink = next ? 0 : 1;
    if (this.canvas) {
      this.canvas.dataset.eyes = this.eyesOpen ? 'open' : 'closed';
    }
  }

  blink() {
    this.setEyes(false);
    clearTimeout(this._unblinkTimer);
    this._unblinkTimer = setTimeout(() => {
      this.setEyes(true);
    }, 150);
  }

  startBlinking() {
    this.stopBlinking();
    const scheduleNext = () => {
      const delay =
        BLINK_INTERVAL_MIN_MS +
        Math.floor(Math.random() * (BLINK_INTERVAL_MAX_MS - BLINK_INTERVAL_MIN_MS));
      this._blinkTimer = setTimeout(() => {
        this.blink();
        // Occasional double blink for lifelike anime charm
        if (Math.random() < 0.18) {
          setTimeout(() => this.blink(), 260);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  stopBlinking() {
    clearTimeout(this._blinkTimer);
    clearTimeout(this._unblinkTimer);
    this._blinkTimer = null;
    this._unblinkTimer = null;
  }

  startAnimationLoop() {
    if (this._raf) return;
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this._lastFrameTime) / 1000));
      this._lastFrameTime = now;
      this._stepPhysics(now, dt);
      this.render(now);
      if (typeof requestAnimationFrame === 'function') {
        this._raf = requestAnimationFrame(loop);
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      this._raf = requestAnimationFrame(loop);
    }
  }

  _stepPhysics(now, dt) {
    // Fast coarticulation interpolation (~24 Hz response so consonants snap crisply while vowels glide smoothly)
    const mouthSpeed = Math.min(1, dt * 24);
    for (const key of Object.keys(this.mouthState)) {
      this.mouthState[key] = lerp(this.mouthState[key], this.targetMouth[key] ?? 0, mouthSpeed);
    }

    // 4-step anime blink interpolation
    const blinkSpeed = Math.min(1, dt * 22);
    this.blinkStep = lerp(this.blinkStep, this.targetBlink, blinkSpeed);

    // Idle eye saccades when pointer hasn't moved recently
    if (now - this.lastPointerMoveAt > 3500) {
      if (this.mood === 'thinking') {
        this.targetGazeX = Math.sin(now * 0.0015) * 0.45;
        this.targetGazeY = -0.35 + Math.cos(now * 0.002) * 0.15;
      } else {
        this.targetGazeX = Math.sin(now * 0.0007) * 0.22;
        this.targetGazeY = Math.cos(now * 0.0009) * 0.12;
      }
    }
    const gazeSpeed = Math.min(1, dt * 8);
    this.gazeX = lerp(this.gazeX, this.targetGazeX, gazeSpeed);
    this.gazeY = lerp(this.gazeY, this.targetGazeY, gazeSpeed);
  }

  render(now = performance.now()) {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const breath = Math.sin(now * 0.0022) * 3.5;
    const talkBounce = this.mouthState.open * 4.5;
    const headOffsetX = this.gazeX * 5;
    const headOffsetY = breath + this.gazeY * 3;

    // 1. Ambient BMO Screen Backdrop with soft radial glow & subtle scanlines
    this._drawScreenBackdrop(ctx, w, h, now);

    ctx.save();
    ctx.translate(headOffsetX, headOffsetY);

    // 2. Back Anime Hair Silhouette & Neck/Shoulders
    this._drawBackHairAndNeck(ctx, w, h, now);

    // 3. Sculpted Anime Face Contour, Ears & Cel-Shaded Skin + Cheek Blush
    this._drawFaceHeadAndEars(ctx, w, h, talkBounce);

    // 4. Expressive 4-Step Blinking Anime Eyes with Emerald/Teal Irises & Catchlights
    this._drawAnimeEyes(ctx, w, h, now);

    // 5. Delicate Cel-Shaded Anime Nose (bridge highlight + warm nostril shadow)
    this._drawAnimeNose(ctx, w, h, talkBounce * 0.25);

    // 6. High-Detail 12-Viseme Anime Lips, Teeth & Articulated Tongue
    this._drawAnimeMouthViseme(ctx, w, h, talkBounce);

    // 7. Layered Anime Front Hair Bangs & Side Locks with Specular Halo
    this._drawFrontHairBangs(ctx, w, h, now);

    ctx.restore();

    if (this.canvas) {
      this.canvas.dataset.viseme = this.currentViseme;
      this.canvas.dataset.eyes = this.eyesOpen ? 'open' : 'closed';
    }
  }

  _drawScreenBackdrop(ctx, w, h, now) {
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
    bgGrad.addColorStop(0, '#a8f0dc');
    bgGrad.addColorStop(0.55, '#68cbb5');
    bgGrad.addColorStop(1, '#399180');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft floating bokeh sparkles in the background
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    const sparkles = [
      { x: 0.14, y: 0.2, r: 10, s: 0.0012 },
      { x: 0.86, y: 0.18, r: 14, s: 0.0015 },
      { x: 0.12, y: 0.76, r: 8, s: 0.0018 },
      { x: 0.88, y: 0.72, r: 12, s: 0.0011 },
    ];
    for (const sp of sparkles) {
      const py = sp.y * h + Math.sin(now * sp.s + sp.x * 10) * 8;
      ctx.beginPath();
      ctx.arc(sp.x * w, py, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBackHairAndNeck(ctx, w, h, now) {
    const sway = Math.sin(now * 0.0018) * 3;

    // Back hair volume (deep teal-slate anime bob)
    ctx.save();
    const hairGrad = ctx.createLinearGradient(w * 0.5, h * 0.06, w * 0.5, h * 0.88);
    hairGrad.addColorStop(0, '#1e4e4a');
    hairGrad.addColorStop(0.5, '#153938');
    hairGrad.addColorStop(1, '#0e2627');
    ctx.fillStyle = hairGrad;

    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.45);
    ctx.bezierCurveTo(w * 0.11, h * 0.15, w * 0.3, h * 0.05, w * 0.5, h * 0.05);
    ctx.bezierCurveTo(w * 0.7, h * 0.05, w * 0.89, h * 0.15, w * 0.84, h * 0.45);
    ctx.bezierCurveTo(w * 0.87 + sway * 0.4, h * 0.68, w * 0.8, h * 0.85, w * 0.71, h * 0.89);
    ctx.lineTo(w * 0.29, h * 0.89);
    ctx.bezierCurveTo(w * 0.2, h * 0.85, w * 0.13 + sway * 0.4, h * 0.68, w * 0.16, h * 0.45);
    ctx.closePath();
    ctx.fill();

    // Neck & collar hint
    const neckGrad = ctx.createLinearGradient(w * 0.5, h * 0.78, w * 0.5, h * 0.98);
    neckGrad.addColorStop(0, '#e3a588');
    neckGrad.addColorStop(0.45, '#f6bfa4');
    neckGrad.addColorStop(1, '#ecc0a8');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.41, h * 0.78);
    ctx.lineTo(w * 0.59, h * 0.78);
    ctx.quadraticCurveTo(w * 0.61, h * 0.91, w * 0.68, h * 0.98);
    ctx.lineTo(w * 0.32, h * 0.98);
    ctx.quadraticCurveTo(w * 0.39, h * 0.91, w * 0.41, h * 0.78);
    ctx.closePath();
    ctx.fill();

    // BMO hoodie/collar trim at very bottom
    ctx.fillStyle = '#207567';
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 1.02);
    ctx.quadraticCurveTo(w * 0.5, h * 0.89, w * 0.75, h * 1.02);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawFaceHeadAndEars(ctx, w, h, jawDrop) {
    ctx.save();

    // Left & Right Anime Ears
    for (const side of [-1, 1]) {
      const ex = w * 0.5 + side * w * 0.315;
      const ey = h * 0.49;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(side * 0.14);

      const earGrad = ctx.createLinearGradient(0, -36, 0, 36);
      earGrad.addColorStop(0, '#ffd4bc');
      earGrad.addColorStop(1, '#f2b193');
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = '#6e3b2c';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner ear fold shadow
      ctx.fillStyle = '#e59a7e';
      ctx.beginPath();
      ctx.ellipse(-side * 3, 2, 11, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Main Sculpted Anime Head / Chin Contour
    const chinY = h * 0.835 + jawDrop * 1.1;
    const skinGrad = ctx.createRadialGradient(w * 0.5, h * 0.44, w * 0.05, w * 0.5, h * 0.52, w * 0.38);
    skinGrad.addColorStop(0, '#ffe4d2');
    skinGrad.addColorStop(0.68, '#ffd1b6');
    skinGrad.addColorStop(1, '#f4b596');

    ctx.fillStyle = skinGrad;
    ctx.strokeStyle = '#5c2f23';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.36);
    ctx.bezierCurveTo(w * 0.2, h * 0.14, w * 0.8, h * 0.14, w * 0.8, h * 0.36);
    ctx.bezierCurveTo(w * 0.81, h * 0.55, w * 0.77, h * 0.69, w * 0.65, h * 0.77 + jawDrop * 0.6);
    ctx.quadraticCurveTo(w * 0.54, chinY, w * 0.5, chinY);
    ctx.quadraticCurveTo(w * 0.46, chinY, w * 0.35, h * 0.77 + jawDrop * 0.6);
    ctx.bezierCurveTo(w * 0.23, h * 0.69, w * 0.19, h * 0.55, w * 0.2, h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft Anime Cheek Blush & Subsurface Glow
    for (const side of [-1, 1]) {
      const bx = w * 0.5 + side * w * 0.195;
      const by = h * 0.555;
      const blushGrad = ctx.createRadialGradient(bx, by, 4, bx, by, 48);
      blushGrad.addColorStop(0, 'rgba(255, 118, 132, 0.42)');
      blushGrad.addColorStop(0.6, 'rgba(255, 135, 145, 0.16)');
      blushGrad.addColorStop(1, 'rgba(255, 135, 145, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, 48, 30, side * -0.12, 0, Math.PI * 2);
      ctx.fill();

      // Subtle anime blush slash lines
      ctx.strokeStyle = 'rgba(235, 92, 112, 0.28)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 11 - 4, by + 5);
        ctx.lineTo(bx + i * 11 + 4, by - 5);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  _drawAnimeEyes(ctx, w, h, now) {
    // Discrete 4-step anime blink quantization inspired by eyes.jpg
    const b = this.blinkStep;
    const openness = b > 0.82 ? 0.0 : b > 0.52 ? 0.32 : b > 0.2 ? 0.68 : 1.0;

    const eyeY = h * 0.435;
    const eyeSpanX = w * 0.165;
    const eyeW = 62;
    const eyeH = 50;

    for (const side of [-1, 1]) {
      const cx = w * 0.5 + side * eyeSpanX;
      const cy = eyeY;

      ctx.save();
      ctx.translate(cx, cy);

      if (openness <= 0.05) {
        // Step 4: Closed anime eye arch with lush eyelashes
        ctx.strokeStyle = '#14161d';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.88, 4);
        ctx.quadraticCurveTo(0, 22, eyeW * 0.88, 2);
        ctx.stroke();

        // Eyelash flicks on closed eye
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(side * eyeW * 0.72, 6);
        ctx.lineTo(side * eyeW * 0.98, 15);
        ctx.moveTo(side * eyeW * 0.42, 12);
        ctx.lineTo(side * eyeW * 0.55, 22);
        ctx.stroke();

        // Delicate upper eyelid crease line
        ctx.strokeStyle = 'rgba(92, 47, 35, 0.45)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.65, -12);
        ctx.quadraticCurveTo(0, -4, eyeW * 0.65, -12);
        ctx.stroke();
      } else {
        const curH = eyeH * openness;

        // Sclera (white of the eye with subtle top shadow)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.9, 2);
        ctx.bezierCurveTo(-eyeW * 0.55, -curH * 0.95, eyeW * 0.55, -curH * 0.95, eyeW * 0.9, 0);
        ctx.bezierCurveTo(eyeW * 0.55, curH * 0.88, -eyeW * 0.55, curH * 0.88, -eyeW * 0.9, 2);
        ctx.closePath();

        const scleraGrad = ctx.createLinearGradient(0, -curH, 0, curH);
        scleraGrad.addColorStop(0, '#d8e4e8');
        scleraGrad.addColorStop(0.28, '#ffffff');
        scleraGrad.addColorStop(1, '#f7fbfc');
        ctx.fillStyle = scleraGrad;
        ctx.fill();
        ctx.clip();

        // Iris position with live gaze tracking
        const ix = this.gazeX * 14;
        const iy = this.gazeY * 8;
        const irisR = 31;

        // Outer limbal ring (deep emerald-forest border)
        ctx.fillStyle = '#0c2c24';
        ctx.beginPath();
        ctx.ellipse(ix, iy, irisR, irisR * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rich Anime Iris Gradient (vibrant green-teal like BMO's eyes.jpg row 1)
        const irisGrad = ctx.createLinearGradient(ix, iy - irisR, ix, iy + irisR);
        irisGrad.addColorStop(0, '#185a37');
        irisGrad.addColorStop(0.45, '#39b54a');
        irisGrad.addColorStop(0.82, '#7ce868');
        irisGrad.addColorStop(1, '#a9ff82');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy, irisR - 3.5, (irisR - 3.5) * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Radial anime iris shimmer spokes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6;
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(ang) * 11, iy + Math.sin(ang) * 11);
          ctx.lineTo(ix + Math.cos(ang) * (irisR - 5), iy + Math.sin(ang) * (irisR - 5));
          ctx.stroke();
        }

        // Deep velvet pupil with subtle breathing pulse
        const pupilR = 14.5 + Math.sin(now * 0.003) * 0.6;
        ctx.fillStyle = '#0b1014';
        ctx.beginPath();
        ctx.ellipse(ix, iy, pupilR, pupilR * 1.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lower iris luminous crescent
        ctx.fillStyle = 'rgba(195, 255, 160, 0.45)';
        ctx.beginPath();
        ctx.ellipse(ix, iy + irisR * 0.48, irisR * 0.52, irisR * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Primary Upper-Left Anime Specular Catchlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ix - 11, iy - 11, 9.5, 7.5, -0.35, 0, Math.PI * 2);
        ctx.fill();

        // Secondary Lower-Right Gem Catchlight
        ctx.beginPath();
        ctx.arc(ix + 10, iy + 10, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny starlight pinpoint
        ctx.beginPath();
        ctx.arc(ix - 14, iy + 6, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Soft upper eyelid cast shadow across top of eye
        ctx.fillStyle = 'rgba(18, 38, 48, 0.22)';
        ctx.fillRect(-eyeW, -curH, eyeW * 2, curH * 0.42);

        ctx.restore(); // end sclera clip

        // Bold Anime Upper Eyelash Line
        ctx.fillStyle = '#11131a';
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.96, 4);
        ctx.bezierCurveTo(-eyeW * 0.6, -curH * 1.16, eyeW * 0.6, -curH * 1.16, eyeW * 0.98, 2);
        ctx.lineTo(eyeW * 0.86, 6);
        ctx.bezierCurveTo(eyeW * 0.52, -curH * 0.84, -eyeW * 0.52, -curH * 0.84, -eyeW * 0.88, 6);
        ctx.closePath();
        ctx.fill();

        // Outer Winged Eyelash Flick
        ctx.beginPath();
        ctx.moveTo(side * eyeW * 0.78, -curH * 0.28);
        ctx.quadraticCurveTo(side * eyeW * 1.08, -curH * 0.55, side * eyeW * 1.12, -curH * 0.12);
        ctx.lineTo(side * eyeW * 0.85, 2);
        ctx.closePath();
        ctx.fill();

        // Lower Eyelid Define Line
        ctx.strokeStyle = '#331c16';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.78, curH * 0.48);
        ctx.quadraticCurveTo(0, curH * 0.92, eyeW * 0.78, curH * 0.45);
        ctx.stroke();

        // Upper Eyelid Fold Crease (classic anime double-lid detail)
        ctx.strokeStyle = 'rgba(95, 45, 32, 0.55)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.72, -curH * 0.82 - 10);
        ctx.quadraticCurveTo(0, -curH * 1.12 - 12, eyeW * 0.74, -curH * 0.78 - 9);
        ctx.stroke();
      }

      // Expressive Anime Eyebrow
      const browLift = this.mouthState.open * 7 + (this.mood === 'listening' ? 4 : 0);
      const browTilt = this.mood === 'thinking' ? side * 0.12 : -side * 0.05;
      ctx.save();
      ctx.translate(0, -eyeH * 1.22 - browLift);
      ctx.rotate(browTilt);
      ctx.fillStyle = '#183f3d';
      ctx.beginPath();
      ctx.moveTo(-eyeW * 0.78, 4);
      ctx.quadraticCurveTo(0, -10, eyeW * 0.78, 2);
      ctx.quadraticCurveTo(0, -2, -eyeW * 0.78, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  }

  _drawAnimeNose(ctx, w, h, bounceY) {
    const nx = w * 0.5 + this.gazeX * 3.5;
    const ny = h * 0.548 + bounceY;

    ctx.save();
    ctx.translate(nx, ny);

    // Warm cel-shaded anime nose shadow wedge
    ctx.fillStyle = 'rgba(214, 132, 104, 0.62)';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-9, 7);
    ctx.quadraticCurveTo(0, 12, 5, 6);
    ctx.closePath();
    ctx.fill();

    // Crisp delicate anime nose bridge & tip line
    ctx.strokeStyle = '#6b3528';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(1, -14);
    ctx.lineTo(-6, 5);
    ctx.quadraticCurveTo(-1, 9, 4, 6);
    ctx.stroke();

    // Specular nose tip highlight dot
    ctx.fillStyle = 'rgba(255, 250, 245, 0.78)';
    ctx.beginPath();
    ctx.ellipse(3.5, 1, 3.2, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawAnimeMouthViseme(ctx, w, h, talkBounce) {
    const m = this.mouthState;
    const mx = w * 0.5 + this.gazeX * 3;
    const my = h * 0.675 + talkBounce * 0.35;

    const halfW = lerp(26, 68, clamp(m.width, 0.35, 1.15)) * (1 - m.round * 0.28);
    const openH = lerp(1.5, 48, clamp(m.open, 0, 1));
    const smileY = -m.smile * 14;
    const biteShift = m.lipBite * 8;

    ctx.save();
    ctx.translate(mx, my);

    if (openH < 3.5 && m.lipBite < 0.2) {
      // Closed / Neutral / 'M' Plush Anime Lips
      // Upper lip Cupid's bow tint
      const upperGrad = ctx.createLinearGradient(0, -12, 0, 4);
      upperGrad.addColorStop(0, '#d96b70');
      upperGrad.addColorStop(1, '#b84b52');
      ctx.fillStyle = upperGrad;
      ctx.beginPath();
      ctx.moveTo(-halfW, smileY);
      ctx.quadraticCurveTo(-halfW * 0.45, -10, -7, -6);
      ctx.quadraticCurveTo(0, -3, 7, -6);
      ctx.quadraticCurveTo(halfW * 0.45, -10, halfW, smileY);
      ctx.quadraticCurveTo(0, 5, -halfW, smileY);
      ctx.closePath();
      ctx.fill();

      // Lower lip soft gloss pillow
      const lowerGrad = ctx.createLinearGradient(0, 0, 0, 16);
      lowerGrad.addColorStop(0, '#e87a80');
      lowerGrad.addColorStop(1, '#f49b9e');
      ctx.fillStyle = lowerGrad;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.85, smileY + 1);
      ctx.quadraticCurveTo(0, 16, halfW * 0.85, smileY + 1);
      ctx.quadraticCurveTo(0, 4, -halfW * 0.85, smileY + 1);
      ctx.closePath();
      ctx.fill();

      // Crisp anime mouth parting line
      ctx.strokeStyle = '#5c1f28';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-halfW, smileY);
      ctx.bezierCurveTo(-halfW * 0.4, 3, -8, -2, 0, 1);
      ctx.bezierCurveTo(8, -2, halfW * 0.4, 3, halfW, smileY);
      ctx.stroke();

      // Lower lip specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.beginPath();
      ctx.ellipse(0, 7, halfW * 0.28, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Open Articulated Viseme Mouth (A, D, E, F, L, Oh, R, S, Uh, Woo)
      const topY = -openH * (0.48 + m.round * 0.12);
      const botY = openH * (0.68 + m.round * 0.14) - biteShift;

      // Outer Plush Lip Rim
      const lipGrad = ctx.createLinearGradient(0, topY - 10, 0, botY + 14);
      lipGrad.addColorStop(0, '#d45d66');
      lipGrad.addColorStop(0.5, '#c24953');
      lipGrad.addColorStop(1, '#e87980');
      ctx.fillStyle = lipGrad;

      ctx.beginPath();
      ctx.moveTo(-halfW - 6, smileY);
      ctx.bezierCurveTo(-halfW * 0.65, topY - 11, -10, topY - 9, 0, topY - 6);
      ctx.bezierCurveTo(10, topY - 9, halfW * 0.65, topY - 11, halfW + 6, smileY);
      ctx.bezierCurveTo(halfW * 0.82, botY + 13, -halfW * 0.82, botY + 13, -halfW - 6, smileY);
      ctx.closePath();
      ctx.fill();

      // Oral Cavity Interior (clipped for teeth & tongue)
      ctx.save();
      ctx.beginPath();
      if (m.round > 0.65) {
        // Rounded 'Oh' / 'Woo' aperture
        ctx.ellipse(0, (topY + botY) * 0.5, halfW * 0.88, (botY - topY) * 0.52, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(-halfW, smileY);
        ctx.bezierCurveTo(-halfW * 0.55, topY, 0, topY, halfW, smileY);
        ctx.bezierCurveTo(halfW * 0.72, botY, -halfW * 0.72, botY, -halfW, smileY);
      }
      ctx.closePath();

      const cavityGrad = ctx.createLinearGradient(0, topY, 0, botY);
      cavityGrad.addColorStop(0, '#3d0c17');
      cavityGrad.addColorStop(0.6, '#5c1424');
      cavityGrad.addColorStop(1, '#751c2f');
      ctx.fillStyle = cavityGrad;
      ctx.fill();
      ctx.clip();

      // Articulated Tongue (elevates and touches palate for 'L' / 'D' / 'R')
      if (m.tongue > 0.05) {
        const tongueTop = lerp(botY, topY + 4, m.tongue * 0.75);
        const tongueW = halfW * (m.tongueTip > 0.4 ? 0.58 : 0.78);
        const tGrad = ctx.createLinearGradient(0, tongueTop, 0, botY + 8);
        tGrad.addColorStop(0, '#ff7588');
        tGrad.addColorStop(1, '#d13d56');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(0, botY + 2, tongueW, Math.max(8, botY - tongueTop + 6), 0, Math.PI, 0, false);
        ctx.fill();

        // Tongue center groove
        ctx.strokeStyle = 'rgba(145, 25, 48, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, tongueTop + 4);
        ctx.lineTo(0, botY);
        ctx.stroke();
      }

      // Upper Teeth Row
      if (m.upperTeeth > 0.05) {
        const teethH = lerp(0, 14, m.upperTeeth);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-halfW * 0.82, topY - 2, halfW * 1.64, teethH + 2, [0, 0, 6, 6]);
        ctx.fill();

        ctx.strokeStyle = 'rgba(180, 195, 205, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, topY);
        ctx.lineTo(0, topY + teethH);
        ctx.stroke();
      }

      // Lower Teeth Row (visible in 'S', 'E', 'D')
      if (m.lowerTeeth > 0.05 && m.lipBite < 0.3) {
        const lTeethH = lerp(0, 10, m.lowerTeeth);
        ctx.fillStyle = '#f7f9fa';
        ctx.beginPath();
        ctx.roundRect(-halfW * 0.74, botY - lTeethH, halfW * 1.48, lTeethH + 3, [5, 5, 0, 0]);
        ctx.fill();
      }

      ctx.restore(); // end oral cavity clip

      // Crisp Outline around Viseme Mouth Aperture
      ctx.strokeStyle = '#4f1720';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      if (m.round > 0.65) {
        ctx.ellipse(0, (topY + botY) * 0.5, halfW * 0.88, (botY - topY) * 0.52, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(-halfW, smileY);
        ctx.bezierCurveTo(-halfW * 0.55, topY, 0, topY, halfW, smileY);
        ctx.bezierCurveTo(halfW * 0.72, botY, -halfW * 0.72, botY, -halfW, smileY);
      }
      ctx.closePath();
      ctx.stroke();

      // Lower Lip Specular Gloss Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.beginPath();
      ctx.ellipse(0, botY + 5.5, halfW * 0.32, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle Chin / Under-Lip Shadow Crease
    ctx.strokeStyle = 'rgba(178, 96, 74, 0.45)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, openH * 0.68 + 18, 14, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  _drawFrontHairBangs(ctx, w, h, now) {
    const sway = Math.sin(now * 0.002) * 2.5;

    ctx.save();
    const bangGrad = ctx.createLinearGradient(w * 0.5, h * 0.04, w * 0.5, h * 0.42);
    bangGrad.addColorStop(0, '#2b6e67');
    bangGrad.addColorStop(0.55, '#1d524d');
    bangGrad.addColorStop(1, '#143b39');

    ctx.fillStyle = bangGrad;
    ctx.strokeStyle = '#0c2424';
    ctx.lineWidth = 3;

    // Sweeping Anime Forehead Bangs & Side-Framing Locks
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.42);
    ctx.bezierCurveTo(w * 0.15, h * 0.15, w * 0.32, h * 0.05, w * 0.5, h * 0.05);
    ctx.bezierCurveTo(w * 0.68, h * 0.05, w * 0.85, h * 0.15, w * 0.84, h * 0.42);
    // Right side-lock framing cheek
    ctx.quadraticCurveTo(w * 0.83 + sway * 0.3, h * 0.58, w * 0.77 + sway * 0.4, h * 0.66);
    ctx.quadraticCurveTo(w * 0.78, h * 0.46, w * 0.76, h * 0.31);
    // Bangs across forehead
    ctx.quadraticCurveTo(w * 0.68 + sway * 0.2, h * 0.36, w * 0.61, h * 0.25);
    ctx.quadraticCurveTo(w * 0.54 + sway * 0.25, h * 0.38, w * 0.48, h * 0.38);
    ctx.quadraticCurveTo(w * 0.44, h * 0.27, w * 0.37 + sway * 0.2, h * 0.36);
    ctx.quadraticCurveTo(w * 0.3, h * 0.25, w * 0.24, h * 0.32);
    // Left side-lock framing cheek
    ctx.quadraticCurveTo(w * 0.22, h * 0.46, w * 0.23 + sway * 0.4, h * 0.66);
    ctx.quadraticCurveTo(w * 0.17 + sway * 0.3, h * 0.58, w * 0.16, h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Anime Hair Angel-Ring Specular Highlight Band
    ctx.fillStyle = 'rgba(168, 245, 230, 0.28)';
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.18);
    ctx.quadraticCurveTo(w * 0.5, h * 0.12, w * 0.72, h * 0.18);
    ctx.quadraticCurveTo(w * 0.5, h * 0.16, w * 0.28, h * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
