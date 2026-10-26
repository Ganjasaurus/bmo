import { FACE_NAMES } from './visemes.js?v=4';

const BLINK_INTERVAL_MIN_MS = 2600;
const BLINK_INTERVAL_MAX_MS = 5400;
const EYE_THEME_KEY = 'bmo-eye-theme-v1';

/**
 * 4 Jewel Anime Eye Palettes matching the 4 rows of `eyes.jpg`:
 * - emerald: Row 1 (Forest Emerald & Mint Lime)
 * - sapphire: Row 2 (Deep Ocean Sapphire & Sky Cyan)
 * - amber: Row 3 (Warm Honey Amber & Golden Sun)
 * - amethyst: Row 4 (Royal Amethyst Violet & Rose Magenta)
 */
export const EYE_THEMES = {
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    swatch: '#39d46e',
    limbal: '#08221e',
    top: '#0d3d28',
    mid: '#1e8a4c',
    low: '#59e06c',
    bot: '#b6ff9c',
    crescent: 'rgba(225, 255, 185, 0.75)',
    ring: 'rgba(195, 255, 180, 0.55)',
  },
  sapphire: {
    id: 'sapphire',
    label: 'Sapphire',
    swatch: '#38bdf8',
    limbal: '#08182b',
    top: '#0c2c52',
    mid: '#1d6ec2',
    low: '#4bc6ff',
    bot: '#a8f2ff',
    crescent: 'rgba(195, 245, 255, 0.75)',
    ring: 'rgba(175, 238, 255, 0.55)',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    swatch: '#fbbf24',
    limbal: '#261408',
    top: '#52290c',
    mid: '#b86214',
    low: '#f5a623',
    bot: '#fff099',
    crescent: 'rgba(255, 242, 180, 0.78)',
    ring: 'rgba(255, 232, 155, 0.55)',
  },
  amethyst: {
    id: 'amethyst',
    label: 'Amethyst',
    swatch: '#c084fc',
    limbal: '#1f092b',
    top: '#3e1257',
    mid: '#8a32ad',
    low: '#d86bfa',
    bot: '#ffb5f8',
    crescent: 'rgba(255, 210, 250, 0.75)',
    ring: 'rgba(245, 195, 255, 0.55)',
  },
};

/**
 * Anatomical & stylistic anime mouth parameters for all 12 BMO visemes:
 * - open: vertical jaw/lip opening (0..1)
 * - width: horizontal mouth corner span (0.35..1.15)
 * - round: lip pucker / O-shape rounding (0..1)
 * - smile: corner curvature (-0.3..0.6)
 * - upperTeeth: visibility of upper teeth row (0..1)
 * - lowerTeeth: visibility of lower teeth row (0..1)
 * - tongue: tongue elevation & visibility (0..1)
 * - tongueTip: tongue tip touching alveolar ridge for L/D/N/R (0..1)
 * - lipBite: lower lip tucked under upper teeth for F/V (0..1)
 */
export const VISEME_SHAPES = {
  Neutral: {
    open: 0.02,
    width: 0.78,
    round: 0.05,
    smile: 0.3,
    upperTeeth: 0.0,
    lowerTeeth: 0.0,
    tongue: 0.0,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  M: {
    open: 0.0,
    width: 0.85,
    round: 0.02,
    smile: 0.16,
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
    upperTeeth: 0.86,
    lowerTeeth: 0.35,
    tongue: 0.8,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  D: {
    open: 0.44,
    width: 0.88,
    round: 0.08,
    smile: 0.2,
    upperTeeth: 0.88,
    lowerTeeth: 0.45,
    tongue: 0.58,
    tongueTip: 0.68,
    lipBite: 0.0,
  },
  E: {
    open: 0.5,
    width: 1.08,
    round: 0.0,
    smile: 0.44,
    upperTeeth: 0.92,
    lowerTeeth: 0.48,
    tongue: 0.54,
    tongueTip: 0.0,
    lipBite: 0.0,
  },
  F: {
    open: 0.22,
    width: 0.82,
    round: 0.1,
    smile: 0.12,
    upperTeeth: 0.96,
    lowerTeeth: 0.0,
    tongue: 0.15,
    tongueTip: 0.0,
    lipBite: 0.92,
  },
  L: {
    open: 0.6,
    width: 0.86,
    round: 0.1,
    smile: 0.22,
    upperTeeth: 0.84,
    lowerTeeth: 0.28,
    tongue: 0.88,
    tongueTip: 0.96,
    lipBite: 0.0,
  },
  Oh: {
    open: 0.86,
    width: 0.56,
    round: 0.92,
    smile: 0.0,
    upperTeeth: 0.45,
    lowerTeeth: 0.15,
    tongue: 0.64,
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
    tongue: 0.72,
    tongueTip: 0.45,
    lipBite: 0.0,
  },
  S: {
    open: 0.26,
    width: 0.96,
    round: 0.04,
    smile: 0.32,
    upperTeeth: 0.96,
    lowerTeeth: 0.82,
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
    tongue: 0.4,
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
    this.eyeTheme = 'emerald';
    try {
      const savedTheme = typeof localStorage !== 'undefined' && localStorage.getItem(EYE_THEME_KEY);
      if (savedTheme && EYE_THEMES[savedTheme]) this.eyeTheme = savedTheme;
    } catch {
      // ignore storage errors
    }

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

  setEyeTheme(themeId) {
    if (!EYE_THEMES[themeId]) return;
    this.eyeTheme = themeId;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(EYE_THEME_KEY, themeId);
    } catch {
      // ignore
    }
    this.render(performance.now());
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

  /**
   * Immediately snaps mouth state to the current target viseme (useful for deterministic screenshots/tests).
   */
  snapToTargetViseme() {
    this.mouthState = { ...this.targetMouth };
    this.render(performance.now());
  }

  setEyes(open) {
    const next = Boolean(open);
    this.eyesOpen = next;
    this.targetBlink = next ? 0 : 1;
    if (this.canvas) {
      this.canvas.dataset.eyes = this.eyesOpen ? 'open' : 'closed';
    }
  }

  /**
   * Sets one of the 4 discrete anime blink stages (0 = open, 1 = 3/4, 2 = half, 3 = closed).
   */
  setBlinkStage(stage) {
    const map = [0.0, 0.35, 0.65, 1.0];
    const b = map[clamp(Math.round(stage), 0, 3)];
    this.blinkStep = b;
    this.targetBlink = b;
    this.eyesOpen = b < 0.8;
    this.render(performance.now());
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
    // Fast coarticulation interpolation (~26 Hz response so consonants snap crisply while vowels glide smoothly)
    const mouthSpeed = Math.min(1, dt * 26);
    for (const key of Object.keys(this.mouthState)) {
      this.mouthState[key] = lerp(this.mouthState[key], this.targetMouth[key] ?? 0, mouthSpeed);
    }

    // 4-step anime blink interpolation
    const blinkSpeed = Math.min(1, dt * 22);
    this.blinkStep = lerp(this.blinkStep, this.targetBlink, blinkSpeed);

    // Idle eye saccades when pointer hasn't moved recently
    if (now - this.lastPointerMoveAt > 3500) {
      if (this.mood === 'thinking') {
        this.targetGazeX = Math.sin(now * 0.0015) * 0.42;
        this.targetGazeY = -0.32 + Math.cos(now * 0.002) * 0.14;
      } else {
        this.targetGazeX = Math.sin(now * 0.0007) * 0.2;
        this.targetGazeY = Math.cos(now * 0.0009) * 0.1;
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

    const breath = Math.sin(now * 0.0022) * 3.2;
    const talkBounce = this.mouthState.open * 4.2;
    const headOffsetX = this.gazeX * 4.8;
    const headOffsetY = breath + this.gazeY * 2.8;

    // 1. Ambient BMO Screen Backdrop with soft radial glow, scanline sheen & twinkling sparkles
    this._drawScreenBackdrop(ctx, w, h, now);

    ctx.save();
    ctx.translate(headOffsetX, headOffsetY);

    // 2. Back Anime Hair Silhouette & Neck/Shoulders
    this._drawBackHairAndNeck(ctx, w, h, now);

    // 3. Sculpted Anime Face Contour, Ears, Forehead Cast Shadow & Cheek Blush
    this._drawFaceHeadAndEars(ctx, w, h, talkBounce);

    // 4. Masterpiece 4-Step Blinking Anime Eyes with 24-Spoke Jewel Irises & Lash Spikes
    this._drawAnimeEyes(ctx, w, h, now);

    // 5. Broken-Line Cel-Shaded Anime Nose (bridge highlight + warm nostril wedge)
    this._drawAnimeNose(ctx, w, h, talkBounce * 0.22);

    // 6. Studio-Grade 12-Viseme Anime Lips, Philtrum, Teeth & Articulated Tongue
    this._drawAnimeMouthViseme(ctx, w, h, talkBounce);

    // 7. Layered Anime Front Hair Bangs, Side Locks, Ahoge Tuft & Dual Angel-Ring Halo
    this._drawFrontHairBangs(ctx, w, h, now, talkBounce);

    ctx.restore();

    if (this.canvas) {
      this.canvas.dataset.viseme = this.currentViseme;
      this.canvas.dataset.eyes = this.eyesOpen ? 'open' : 'closed';
    }
  }

  _drawScreenBackdrop(ctx, w, h, now) {
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.06, w * 0.5, h * 0.5, w * 0.74);
    bgGrad.addColorStop(0, '#b5f7e6');
    bgGrad.addColorStop(0.55, '#68cbb5');
    bgGrad.addColorStop(1, '#338877');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft anime four-point sparkles & bokeh in background
    ctx.save();
    const sparkles = [
      { x: 0.13, y: 0.19, r: 9, s: 0.0014, star: true },
      { x: 0.87, y: 0.17, r: 12, s: 0.0016, star: false },
      { x: 0.11, y: 0.76, r: 8, s: 0.0019, star: false },
      { x: 0.88, y: 0.73, r: 10, s: 0.0012, star: true },
    ];
    for (const sp of sparkles) {
      const px = sp.x * w;
      const py = sp.y * h + Math.sin(now * sp.s + sp.x * 10) * 7;
      if (sp.star) {
        const pulse = 0.75 + Math.sin(now * 0.003 + sp.x * 5) * 0.25;
        const sr = sp.r * pulse;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
        ctx.beginPath();
        ctx.moveTo(px, py - sr);
        ctx.quadraticCurveTo(px, py, px + sr, py);
        ctx.quadraticCurveTo(px, py, px, py + sr);
        ctx.quadraticCurveTo(px, py, px - sr, py);
        ctx.quadraticCurveTo(px, py, px, py - sr);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(px, py, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawBackHairAndNeck(ctx, w, h, now) {
    const sway = Math.sin(now * 0.0018) * 3.2;

    ctx.save();
    // Back hair volume (deep emerald-slate anime bob with layered tips)
    const hairGrad = ctx.createLinearGradient(w * 0.5, h * 0.05, w * 0.5, h * 0.9);
    hairGrad.addColorStop(0, '#1f524d');
    hairGrad.addColorStop(0.5, '#143837');
    hairGrad.addColorStop(1, '#0b2021');
    ctx.fillStyle = hairGrad;
    ctx.strokeStyle = '#091a1b';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.44);
    ctx.bezierCurveTo(w * 0.1, h * 0.14, w * 0.3, h * 0.04, w * 0.5, h * 0.04);
    ctx.bezierCurveTo(w * 0.7, h * 0.04, w * 0.9, h * 0.14, w * 0.85, h * 0.44);
    ctx.bezierCurveTo(w * 0.88 + sway * 0.4, h * 0.68, w * 0.81, h * 0.85, w * 0.71, h * 0.9);
    ctx.lineTo(w * 0.29, h * 0.9);
    ctx.bezierCurveTo(w * 0.19, h * 0.85, w * 0.12 + sway * 0.4, h * 0.68, w * 0.15, h * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Slender Anime Neck with warm chin cast shadow
    const neckGrad = ctx.createLinearGradient(w * 0.5, h * 0.77, w * 0.5, h * 0.98);
    neckGrad.addColorStop(0, '#d89275');
    neckGrad.addColorStop(0.38, '#f5bda2');
    neckGrad.addColorStop(1, '#ffcfb8');
    ctx.fillStyle = neckGrad;
    ctx.strokeStyle = '#5c2f23';
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.moveTo(w * 0.415, h * 0.77);
    ctx.lineTo(w * 0.585, h * 0.77);
    ctx.quadraticCurveTo(w * 0.6, h * 0.91, w * 0.68, h * 0.98);
    ctx.lineTo(w * 0.32, h * 0.98);
    ctx.quadraticCurveTo(w * 0.4, h * 0.91, w * 0.415, h * 0.77);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle collarbone / sternocleidomastoid anime highlight lines
    ctx.strokeStyle = 'rgba(205, 122, 95, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.44, h * 0.84);
    ctx.lineTo(w * 0.46, h * 0.93);
    ctx.moveTo(w * 0.56, h * 0.84);
    ctx.lineTo(w * 0.54, h * 0.93);
    ctx.stroke();

    // BMO teal hoodie/collar trim with gold piping at bottom
    const collarGrad = ctx.createLinearGradient(w * 0.5, h * 0.91, w * 0.5, h);
    collarGrad.addColorStop(0, '#258574');
    collarGrad.addColorStop(1, '#155449');
    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 1.02);
    ctx.quadraticCurveTo(w * 0.5, h * 0.885, w * 0.76, h * 1.02);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 1.0);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.73, h * 1.0);
    ctx.stroke();

    ctx.restore();
  }

  _drawFaceHeadAndEars(ctx, w, h, jawDrop) {
    ctx.save();

    // Left & Right Sculpted Anime Ears with Helix & Tragus Detail
    for (const side of [-1, 1]) {
      const ex = w * 0.5 + side * w * 0.312;
      const ey = h * 0.495;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(side * 0.15);

      const earGrad = ctx.createLinearGradient(0, -38, 0, 38);
      earGrad.addColorStop(0, '#ffd8c2');
      earGrad.addColorStop(0.6, '#ffbfa2');
      earGrad.addColorStop(1, '#eda487');
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = '#5c2f23';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 41, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner concha ear shadow
      ctx.fillStyle = 'rgba(218, 126, 102, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-side * 3, 2, 11, 23, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp inner helix curve
      ctx.strokeStyle = '#8c4736';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(-side * 2, -4, 12, -0.4 * Math.PI, 0.5 * Math.PI, side < 0);
      ctx.stroke();

      ctx.restore();
    }

    // Main Sculpted Anime Head / V-Line Jaw & Chin Contour
    const chinY = h * 0.832 + jawDrop * 1.05;
    const skinGrad = ctx.createRadialGradient(w * 0.5, h * 0.43, w * 0.04, w * 0.5, h * 0.52, w * 0.39);
    skinGrad.addColorStop(0, '#ffece0');
    skinGrad.addColorStop(0.62, '#ffd6be');
    skinGrad.addColorStop(1, '#f3b497');

    ctx.fillStyle = skinGrad;
    ctx.strokeStyle = '#52271d';
    ctx.lineWidth = 3.4;

    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.36);
    ctx.bezierCurveTo(w * 0.2, h * 0.14, w * 0.8, h * 0.14, w * 0.8, h * 0.36);
    ctx.bezierCurveTo(w * 0.81, h * 0.54, w * 0.765, h * 0.685, w * 0.645, h * 0.768 + jawDrop * 0.58);
    ctx.quadraticCurveTo(w * 0.54, chinY, w * 0.5, chinY);
    ctx.quadraticCurveTo(w * 0.46, chinY, w * 0.355, h * 0.768 + jawDrop * 0.58);
    ctx.bezierCurveTo(w * 0.235, h * 0.685, w * 0.19, h * 0.54, w * 0.2, h * 0.36);
    ctx.closePath();
    ctx.fill();

    // Clip inside face contour to paint forehead bang cast shadow & cheek glow cleanly
    ctx.save();
    ctx.clip();

    // Soft Cel-Shaded Forehead Shadow cast by the hair bangs
    const foreheadShadow = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.39);
    foreheadShadow.addColorStop(0, 'rgba(186, 98, 78, 0.42)');
    foreheadShadow.addColorStop(1, 'rgba(186, 98, 78, 0.0)');
    ctx.fillStyle = foreheadShadow;
    ctx.fillRect(w * 0.18, h * 0.18, w * 0.64, h * 0.22);

    // Soft Anime Cheek Blush, Highlight Dot & Subsurface Glow
    const blushBoost = this.mood === 'happy' || this.mood === 'talking' ? 1.12 : 0.95;
    for (const side of [-1, 1]) {
      const bx = w * 0.5 + side * w * 0.195;
      const by = h * 0.552;
      const blushGrad = ctx.createRadialGradient(bx, by, 3, bx, by, 52);
      blushGrad.addColorStop(0, `rgba(255, 108, 128, ${0.44 * blushBoost})`);
      blushGrad.addColorStop(0.58, `rgba(255, 132, 146, ${0.18 * blushBoost})`);
      blushGrad.addColorStop(1, 'rgba(255, 135, 145, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, 52, 31, side * -0.12, 0, Math.PI * 2);
      ctx.fill();

      // Cute anime blush slash lines
      ctx.strokeStyle = 'rgba(230, 82, 105, 0.32)';
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 10.5 - 3.5, by + 4.5);
        ctx.lineTo(bx + i * 10.5 + 3.5, by - 4.5);
        ctx.stroke();
      }

      // Dewy anime cheekbone specular pinpoint
      ctx.fillStyle = 'rgba(255, 252, 248, 0.72)';
      ctx.beginPath();
      ctx.ellipse(bx + side * 12, by - 10, 5.5, 2.5, side * -0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Atmospheric mint-aqua BMO screen rim-light along left cheek & jawline
    ctx.strokeStyle = 'rgba(175, 255, 238, 0.55)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.215, h * 0.48);
    ctx.bezierCurveTo(w * 0.21, h * 0.62, w * 0.26, h * 0.72, w * 0.39, h * 0.79 + jawDrop * 0.58);
    ctx.stroke();

    ctx.restore(); // end face clip

    // Re-trace and stroke crisp outer jaw contour on top
    ctx.strokeStyle = '#52271d';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.36);
    ctx.bezierCurveTo(w * 0.2, h * 0.14, w * 0.8, h * 0.14, w * 0.8, h * 0.36);
    ctx.bezierCurveTo(w * 0.81, h * 0.54, w * 0.765, h * 0.685, w * 0.645, h * 0.768 + jawDrop * 0.58);
    ctx.quadraticCurveTo(w * 0.54, chinY, w * 0.5, chinY);
    ctx.quadraticCurveTo(w * 0.46, chinY, w * 0.355, h * 0.768 + jawDrop * 0.58);
    ctx.bezierCurveTo(w * 0.235, h * 0.685, w * 0.19, h * 0.54, w * 0.2, h * 0.36);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _drawAnimeEyes(ctx, w, h, now) {
    // Discrete 4-step anime blink quantization inspired by eyes.jpg
    const b = this.blinkStep;
    const openness = b > 0.82 ? 0.0 : b > 0.52 ? 0.34 : b > 0.2 ? 0.7 : 1.0;

    const eyeY = h * 0.436;
    const eyeSpanX = w * 0.166;
    const eyeW = 63;
    const eyeH = 51;

    for (const side of [-1, 1]) {
      const cx = w * 0.5 + side * eyeSpanX;
      const cy = eyeY;

      ctx.save();
      ctx.translate(cx, cy);

      if (openness <= 0.05) {
        // Step 4: Closed peaceful anime eye arch with individual curved eyelashes
        ctx.strokeStyle = '#15141f';
        ctx.lineWidth = 6.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.88, 3);
        ctx.quadraticCurveTo(0, 21, eyeW * 0.88, 1);
        ctx.stroke();

        // Warm burgundy accent along closed lash line
        ctx.strokeStyle = '#4a1c2a';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.72, 1);
        ctx.quadraticCurveTo(0, 17, eyeW * 0.72, -1);
        ctx.stroke();

        // Individual curved lash flicks on closed eye
        ctx.strokeStyle = '#15141f';
        ctx.lineWidth = 3.6;
        const lashes = [
          { x0: side * eyeW * 0.76, y0: 4, x1: side * eyeW * 1.02, y1: 13 },
          { x0: side * eyeW * 0.48, y0: 11, x1: side * eyeW * 0.64, y1: 22 },
          { x0: side * eyeW * 0.16, y0: 14, x1: side * eyeW * 0.22, y1: 24 },
        ];
        for (const l of lashes) {
          ctx.beginPath();
          ctx.moveTo(l.x0, l.y0);
          ctx.lineTo(l.x1, l.y1);
          ctx.stroke();
        }

        // Delicate upper eyelid crease line
        ctx.strokeStyle = 'rgba(96, 46, 34, 0.45)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.68, -12);
        ctx.quadraticCurveTo(0, -4, eyeW * 0.68, -12);
        ctx.stroke();
      } else {
        const curH = eyeH * openness;
        const innerX = -side * eyeW * 0.88; // Medial corner (tear duct)
        const outerX = side * eyeW * 0.92;  // Lateral corner (outer wing)

        // 1. Sclera (white of the eye with soft blue-grey top shadow & pink tear duct)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(innerX, 4);
        ctx.bezierCurveTo(
          innerX * 0.55,
          -curH * 0.96,
          outerX * 0.58,
          -curH * 1.04,
          outerX,
          -2
        );
        ctx.bezierCurveTo(
          outerX * 0.62,
          curH * 0.88,
          innerX * 0.58,
          curH * 0.86,
          innerX,
          4
        );
        ctx.closePath();

        const scleraGrad = ctx.createLinearGradient(0, -curH, 0, curH);
        scleraGrad.addColorStop(0, '#cfdce2');
        scleraGrad.addColorStop(0.28, '#ffffff');
        scleraGrad.addColorStop(1, '#f5fbfd');
        ctx.fillStyle = scleraGrad;
        ctx.fill();
        ctx.clip();

        // Subtle medial tear-duct caruncle hint tucked at the inner corner
        ctx.fillStyle = 'rgba(235, 145, 152, 0.35)';
        ctx.beginPath();
        ctx.arc(innerX + side * 1.5, 3.5, 3.0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Multi-Layered Jewel Anime Iris with Live Gaze Tracking & Theme Palette
        const theme = EYE_THEMES[this.eyeTheme] || EYE_THEMES.emerald;
        const ix = this.gazeX * 13.5;
        const iy = this.gazeY * 7.5 + 1;
        const irisR = 32;

        // Outer limbal ring
        ctx.fillStyle = theme.limbal;
        ctx.beginPath();
        ctx.ellipse(ix, iy, irisR, irisR * 1.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main 4-stop Jewel Iris Gradient
        const irisGrad = ctx.createLinearGradient(ix, iy - irisR, ix, iy + irisR);
        irisGrad.addColorStop(0, theme.top);
        irisGrad.addColorStop(0.38, theme.mid);
        irisGrad.addColorStop(0.75, theme.low);
        irisGrad.addColorStop(1, theme.bot);
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy, irisR - 3.2, (irisR - 3.2) * 1.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Upper iris twilight shadow dome (classic anime eye depth)
        const domeGrad = ctx.createLinearGradient(ix, iy - irisR, ix, iy + 4);
        domeGrad.addColorStop(0, 'rgba(7, 24, 30, 0.72)');
        domeGrad.addColorStop(1, 'rgba(7, 24, 30, 0.0)');
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy - 4, irisR - 3.5, (irisR - 3.5) * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        // 24 alternating radial iris crystalline fibers
        for (let a = 0; a < 24; a++) {
          const ang = (a * Math.PI) / 12;
          ctx.strokeStyle = a % 2 === 0 ? 'rgba(255, 255, 255, 0.24)' : 'rgba(8, 22, 28, 0.28)';
          ctx.lineWidth = a % 2 === 0 ? 1.5 : 1.1;
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(ang) * 12, iy + Math.sin(ang) * 12);
          ctx.lineTo(ix + Math.cos(ang) * (irisR - 4.5), iy + Math.sin(ang) * (irisR - 4.5));
          ctx.stroke();
        }

        // Luminous lower iris crescent gem reflection
        const crescentGrad = ctx.createRadialGradient(ix, iy + irisR * 0.45, 2, ix, iy + irisR * 0.45, irisR * 0.58);
        crescentGrad.addColorStop(0, theme.crescent);
        crescentGrad.addColorStop(0.65, theme.ring);
        crescentGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = crescentGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy + irisR * 0.44, irisR * 0.56, irisR * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing ring around the pupil
        const pupilR = 13.8 + Math.sin(now * 0.003) * 0.6 + (this.mood === 'listening' ? 0.8 : 0);
        ctx.strokeStyle = theme.ring;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(ix, iy, pupilR + 2.2, (pupilR + 2.2) * 1.06, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Deep velvet pupil with subtle emerald core
        const pupilGrad = ctx.createRadialGradient(ix, iy, 2, ix, iy, pupilR);
        pupilGrad.addColorStop(0, '#050c0b');
        pupilGrad.addColorStop(0.8, '#0c1b18');
        pupilGrad.addColorStop(1, '#14332b');
        ctx.fillStyle = pupilGrad;
        ctx.beginPath();
        ctx.ellipse(ix, iy, pupilR, pupilR * 1.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Soft iridescent cyan-sky reflection band across upper-right iris
        ctx.fillStyle = 'rgba(180, 242, 255, 0.25)';
        ctx.beginPath();
        ctx.ellipse(ix + 5, iy - 13, 14.5, 5.5, 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Primary Upper-Left Anime Specular Catchlight (crisp studio oval)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ix - 11.5, iy - 11.5, 10, 7.8, -0.35, 0, Math.PI * 2);
        ctx.fill();

        // Four-point starlight diamond twinkle on the pupil edge
        const sx = ix + 9.5;
        const sy = iy - 7.5;
        const sr = 4.2;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sr);
        ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy + sr);
        ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy - sr);
        ctx.closePath();
        ctx.fill();

        // Overlapping warm secondary bubble catchlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(ix - 4.5, iy - 4.5, 3.3, 0, Math.PI * 2);
        ctx.fill();

        // Secondary Lower-Right Gem Catchlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ix + 10.5, iy + 10.5, 4.6, 0, Math.PI * 2);
        ctx.fill();

        // Tiny four-point starlight sparkle on lower-left iris
        ctx.beginPath();
        ctx.arc(ix - 13.5, iy + 7, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Soft upper eyelid cast shadow across top of sclera & iris
        const lidShadow = ctx.createLinearGradient(0, -curH, 0, -curH * 0.25);
        lidShadow.addColorStop(0, 'rgba(12, 32, 42, 0.36)');
        lidShadow.addColorStop(1, 'rgba(12, 32, 42, 0.0)');
        ctx.fillStyle = lidShadow;
        ctx.fillRect(-eyeW, -curH, eyeW * 2, curH * 0.78);

        ctx.restore(); // end sclera clip

        // 3. Sculpted Anime Upper Eyelash Arch with Warm Burgundy Inner Accent
        ctx.fillStyle = '#12131c';
        ctx.beginPath();
        ctx.moveTo(innerX - side * 2, 5);
        ctx.bezierCurveTo(
          innerX * 0.55,
          -curH * 1.18,
          outerX * 0.62,
          -curH * 1.24,
          outerX + side * 4,
          0
        );
        ctx.lineTo(outerX - side * 3, 5);
        ctx.bezierCurveTo(
          outerX * 0.54,
          -curH * 0.86,
          innerX * 0.52,
          -curH * 0.84,
          innerX + side * 2,
          6
        );
        ctx.closePath();
        ctx.fill();

        // Warm plum/burgundy studio highlight along the upper lash ridge
        ctx.strokeStyle = 'rgba(110, 38, 56, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(innerX * 0.7, -curH * 0.68);
        ctx.quadraticCurveTo(0, -curH * 1.05, outerX * 0.75, -curH * 0.72);
        ctx.stroke();

        // 4. Sleek Outer Winged Anime Eyelash Flick
        ctx.fillStyle = '#12131c';
        ctx.beginPath();
        ctx.moveTo(side * eyeW * 0.74, -curH * 0.36);
        ctx.quadraticCurveTo(side * eyeW * 1.1, -curH * 0.54, side * eyeW * 1.14, -curH * 0.14);
        ctx.lineTo(side * eyeW * 0.85, 2);
        ctx.closePath();
        ctx.fill();

        // Subtle secondary outer-corner lash taper
        ctx.beginPath();
        ctx.moveTo(side * eyeW * 0.52, -curH * 0.72);
        ctx.quadraticCurveTo(side * eyeW * 0.82, -curH * 0.96, side * eyeW * 0.94, -curH * 0.68);
        ctx.lineTo(side * eyeW * 0.66, -curH * 0.56);
        ctx.closePath();
        ctx.fill();

        // 5. Lower Eyelid Define Line & Delicate Outer Lash Flick
        ctx.strokeStyle = '#381e18';
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(innerX * 0.72, curH * 0.52);
        ctx.quadraticCurveTo(0, curH * 0.9, outerX * 0.82, curH * 0.42);
        ctx.stroke();

        // Two delicate outer-lower eyelash flicks
        ctx.lineWidth = 1.8;
        for (const t of [0.54, 0.72]) {
          const lx = side * eyeW * t;
          const ly = curH * (0.76 - t * 0.28);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + side * 4.5, ly + 4);
          ctx.stroke();
        }

        // Soft aegyo-sal (smiling lower eye contour shadow)
        ctx.strokeStyle = 'rgba(205, 118, 96, 0.18)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.38, curH * 0.92 + 5);
        ctx.quadraticCurveTo(0, curH * 1.02 + 7, eyeW * 0.42, curH * 0.88 + 4);
        ctx.stroke();

        // 6. Warm Upper Eyelid Subsurface Eyeshadow Tint & Double-Lid Crease
        const lidBlush = ctx.createLinearGradient(0, -curH * 1.25 - 12, 0, -curH * 0.7);
        lidBlush.addColorStop(0, 'rgba(235, 130, 126, 0.0)');
        lidBlush.addColorStop(0.55, 'rgba(235, 130, 126, 0.24)');
        lidBlush.addColorStop(1, 'rgba(235, 130, 126, 0.06)');
        ctx.fillStyle = lidBlush;
        ctx.beginPath();
        ctx.ellipse(0, -curH * 0.92 - 4, eyeW * 0.82, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Warm rose smudge at outer corner of eye
        ctx.fillStyle = 'rgba(218, 96, 108, 0.26)';
        ctx.beginPath();
        ctx.arc(outerX * 0.92, 2, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(92, 42, 30, 0.58)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(innerX * 0.78, -curH * 0.8 - 9);
        ctx.quadraticCurveTo(0, -curH * 1.15 - 12, outerX * 0.8, -curH * 0.76 - 8);
        ctx.stroke();
      }

      // 7. Expressive Anime Eyebrow with Gradient Fill
      const browLift = this.mouthState.open * 6.5 + (this.mood === 'listening' ? 4.5 : 0);
      const browTilt = this.mood === 'thinking' ? side * 0.12 : -side * 0.05;
      ctx.save();
      ctx.translate(0, -eyeH * 1.24 - browLift);
      ctx.rotate(browTilt);
      ctx.fillStyle = '#153a38';
      ctx.beginPath();
      ctx.moveTo(-eyeW * 0.8, 4);
      ctx.quadraticCurveTo(0, -11, eyeW * 0.8, 2);
      ctx.quadraticCurveTo(0, -3, -eyeW * 0.8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  }

  _drawAnimeNose(ctx, w, h, bounceY) {
    const nx = w * 0.5 + this.gazeX * 3.6;
    const ny = h * 0.548 + bounceY;

    ctx.save();
    ctx.translate(nx, ny);

    // 1. Soft upper nose bridge light streak
    ctx.strokeStyle = 'rgba(255, 250, 244, 0.65)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2.5, -26);
    ctx.lineTo(1.5, -10);
    ctx.stroke();

    // 2. Warm cel-shaded anime nose shadow facet
    const noseShadow = ctx.createLinearGradient(-10, -14, 6, 12);
    noseShadow.addColorStop(0, 'rgba(216, 128, 100, 0.58)');
    noseShadow.addColorStop(1, 'rgba(188, 98, 74, 0.42)');
    ctx.fillStyle = noseShadow;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(-9.5, 6.5);
    ctx.quadraticCurveTo(-1, 12.5, 6, 6.5);
    ctx.quadraticCurveTo(1, 3, 0, -17);
    ctx.closePath();
    ctx.fill();

    // 3. Delicate broken-line anime nose contour & tip
    ctx.strokeStyle = '#5e2b20';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0.5, -15);
    ctx.lineTo(-6.8, 5);
    ctx.quadraticCurveTo(-2, 9.5, 4.2, 6.5);
    ctx.stroke();

    // Subtle warm nostril shadow dot on right side
    ctx.fillStyle = 'rgba(128, 56, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(5.5, 7, 2.2, 1.3, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // 4. Soft nose-tip coral blush & dewy pearl highlight
    ctx.fillStyle = 'rgba(255, 118, 134, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 252, 248, 0.88)';
    ctx.beginPath();
    ctx.ellipse(2.8, 1.2, 3.0, 4.8, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawAnimeMouthViseme(ctx, w, h, talkBounce) {
    const m = this.mouthState;
    const mx = w * 0.5 + this.gazeX * 3.0;
    const my = h * 0.674 + talkBounce * 0.35;

    const halfW = lerp(26, 68, clamp(m.width, 0.35, 1.15)) * (1 - m.round * 0.28);
    const openH = lerp(1.5, 48, clamp(m.open, 0, 1));
    const smileY = -m.smile * 14;
    const biteShift = m.lipBite * 8.5;

    ctx.save();
    ctx.translate(mx, my);

    // 1. Subtle Anime Philtrum Dimple above Cupid's Bow
    const philtrumY = -openH * 0.45 - 12;
    const philGrad = ctx.createLinearGradient(0, philtrumY - 12, 0, philtrumY + 4);
    philGrad.addColorStop(0, 'rgba(210, 122, 96, 0.08)');
    philGrad.addColorStop(1, 'rgba(210, 122, 96, 0.34)');
    ctx.fillStyle = philGrad;
    ctx.beginPath();
    ctx.ellipse(0, philtrumY - 3, 5.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (openH < 3.5 && m.lipBite < 0.2) {
      // ====================================================================
      // CLOSED / NEUTRAL / 'M' PLUSH ANIME CUPID'S-BOW LIPS
      // ====================================================================
      const mPress = this.currentViseme === 'M' ? 1.5 : 0;

      // Upper lip Cupid's bow petal
      const upperGrad = ctx.createLinearGradient(0, -13, 0, 4);
      upperGrad.addColorStop(0, '#e37078');
      upperGrad.addColorStop(1, '#bd4852');
      ctx.fillStyle = upperGrad;
      ctx.beginPath();
      ctx.moveTo(-halfW, smileY);
      ctx.quadraticCurveTo(-halfW * 0.45, -11 + mPress, -8, -7 + mPress);
      ctx.quadraticCurveTo(0, -3.5 + mPress, 8, -7 + mPress);
      ctx.quadraticCurveTo(halfW * 0.45, -11 + mPress, halfW, smileY);
      ctx.quadraticCurveTo(0, 5, -halfW, smileY);
      ctx.closePath();
      ctx.fill();

      // Delicate Cupid's bow upper rim highlight
      ctx.strokeStyle = 'rgba(255, 245, 242, 0.62)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-14, -8 + mPress);
      ctx.quadraticCurveTo(-7, -7 + mPress, 0, -3.5 + mPress);
      ctx.quadraticCurveTo(7, -7 + mPress, 14, -8 + mPress);
      ctx.stroke();

      // Lower lip plush gloss cushion
      const lowerGrad = ctx.createLinearGradient(0, 0, 0, 17);
      lowerGrad.addColorStop(0, '#ec7880');
      lowerGrad.addColorStop(0.65, '#f7989e');
      lowerGrad.addColorStop(1, '#e36b73');
      ctx.fillStyle = lowerGrad;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.86, smileY + 1);
      ctx.quadraticCurveTo(0, 17 - mPress, halfW * 0.86, smileY + 1);
      ctx.quadraticCurveTo(0, 3.5, -halfW * 0.86, smileY + 1);
      ctx.closePath();
      ctx.fill();

      // Crisp sculpted anime mouth parting line
      ctx.strokeStyle = '#541922';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-halfW, smileY);
      ctx.bezierCurveTo(-halfW * 0.42, 3, -9, -2.5, 0, 0.8);
      ctx.bezierCurveTo(9, -2.5, halfW * 0.42, 3, halfW, smileY);
      ctx.stroke();

      // Upturned anime mouth corner commissure dimples
      for (const side of [-1, 1]) {
        ctx.strokeStyle = '#541922';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(side * (halfW - 1), smileY + 1);
        ctx.lineTo(side * (halfW + 4.5), smileY - 3.5);
        ctx.stroke();
      }

      // Multi-dot anime lip gloss specular highlights on lower lip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.beginPath();
      ctx.ellipse(-4, 7.5 - mPress * 0.4, halfW * 0.22, 2.6, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(halfW * 0.24, 6.8 - mPress * 0.4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ====================================================================
      // OPEN ARTICULATED 12-VISEME ANIME MOUTH (A, D, E, F, L, Oh, R, S, Uh, Woo)
      // ====================================================================
      const topY = -openH * (0.48 + m.round * 0.12);
      const botY = openH * (0.68 + m.round * 0.14) - biteShift;

      // 1. Outer Plush Lip Cushion (Cupid's Bow + Lower Lip Pillow)
      const lipGrad = ctx.createLinearGradient(0, topY - 12, 0, botY + 15);
      lipGrad.addColorStop(0, '#de646e');
      lipGrad.addColorStop(0.45, '#c44652');
      lipGrad.addColorStop(1, '#f2858d');
      ctx.fillStyle = lipGrad;

      ctx.beginPath();
      ctx.moveTo(-halfW - 6.5, smileY);
      ctx.bezierCurveTo(-halfW * 0.62, topY - 12, -11, topY - 10, 0, topY - 6.5);
      ctx.bezierCurveTo(11, topY - 10, halfW * 0.62, topY - 12, halfW + 6.5, smileY);
      ctx.bezierCurveTo(halfW * 0.82, botY + 14.5, -halfW * 0.82, botY + 14.5, -halfW - 6.5, smileY);
      ctx.closePath();
      ctx.fill();

      // Cupid's bow top edge highlight
      ctx.strokeStyle = 'rgba(255, 245, 242, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-14, topY - 8.5);
      ctx.quadraticCurveTo(-7, topY - 8, 0, topY - 5.5);
      ctx.quadraticCurveTo(7, topY - 8, 14, topY - 8.5);
      ctx.stroke();

      // 2. Oral Cavity Interior (Clipped for Tongue & Teeth)
      ctx.save();
      ctx.beginPath();
      if (m.round > 0.65) {
        // Rounded 'Oh' / 'Woo' aperture
        ctx.ellipse(0, (topY + botY) * 0.5, halfW * 0.86, (botY - topY) * 0.52, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(-halfW, smileY);
        ctx.bezierCurveTo(-halfW * 0.55, topY, 0, topY, halfW, smileY);
        ctx.bezierCurveTo(halfW * 0.74, botY, -halfW * 0.74, botY, -halfW, smileY);
      }
      ctx.closePath();

      const cavityGrad = ctx.createLinearGradient(0, topY, 0, botY);
      cavityGrad.addColorStop(0, '#360913');
      cavityGrad.addColorStop(0.55, '#591222');
      cavityGrad.addColorStop(1, '#781b2f');
      ctx.fillStyle = cavityGrad;
      ctx.fill();
      ctx.clip();

      // Deep soft-palate throat arch shadow for wide-open vowels ('A', 'Oh')
      if (m.open > 0.6) {
        ctx.fillStyle = 'rgba(30, 4, 10, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, (topY + botY) * 0.42, halfW * 0.48, (botY - topY) * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Articulated Anime Tongue & Retroflex/Alveolar Tongue Tip ('L', 'D', 'R')
      if (m.tongue > 0.05) {
        const tongueTop = lerp(botY, topY + 3, m.tongue * 0.78);
        const tongueW = halfW * (m.tongueTip > 0.4 ? 0.6 : 0.78);
        const tGrad = ctx.createLinearGradient(0, tongueTop, 0, botY + 8);
        tGrad.addColorStop(0, '#ff8093');
        tGrad.addColorStop(0.7, '#e8526b');
        tGrad.addColorStop(1, '#bd2f48');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(0, botY + 3, tongueW, Math.max(9, botY - tongueTop + 6), 0, Math.PI, 0, false);
        ctx.fill();

        // Elevated Tongue Tip curled up behind upper teeth for 'L', 'D', 'R'
        if (m.tongueTip > 0.35) {
          const tipH = (botY - topY) * 0.72 * m.tongueTip;
          const tipW = halfW * 0.36;
          const tipGrad = ctx.createLinearGradient(0, topY + 2, 0, topY + tipH + 8);
          tipGrad.addColorStop(0, '#ffa3b1');
          tipGrad.addColorStop(1, '#e6556e');
          ctx.fillStyle = tipGrad;
          ctx.beginPath();
          ctx.moveTo(-tipW, botY);
          ctx.quadraticCurveTo(-tipW * 0.9, topY + 3, 0, topY + 2);
          ctx.quadraticCurveTo(tipW * 0.9, topY + 3, tipW, botY);
          ctx.closePath();
          ctx.fill();

          // Cute anime highlight on raised tongue tip
          ctx.fillStyle = 'rgba(255, 235, 240, 0.5)';
          ctx.beginPath();
          ctx.ellipse(0, topY + 8, tipW * 0.35, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Median sulcus groove on relaxed open tongue
          ctx.strokeStyle = 'rgba(140, 22, 45, 0.38)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, tongueTop + 4);
          ctx.lineTo(0, botY);
          ctx.stroke();
        }
      }

      // 4. Sculpted Upper Teeth Row with Canine/Incisor Hint
      if (m.upperTeeth > 0.05) {
        const teethH = lerp(0, 14.5, m.upperTeeth);
        const teethGrad = ctx.createLinearGradient(0, topY, 0, topY + teethH);
        teethGrad.addColorStop(0, '#e6eef2');
        teethGrad.addColorStop(0.35, '#ffffff');
        teethGrad.addColorStop(1, '#ffffff');
        ctx.fillStyle = teethGrad;

        ctx.beginPath();
        ctx.roundRect(-halfW * 0.82, topY - 2, halfW * 1.64, teethH + 2, [0, 0, 7, 7]);
        ctx.fill();

        // Subtle central incisor & lateral tooth division lines
        ctx.strokeStyle = 'rgba(175, 192, 204, 0.52)';
        ctx.lineWidth = 1.2;
        for (const tx of [-halfW * 0.28, 0, halfW * 0.28]) {
          ctx.beginPath();
          ctx.moveTo(tx, topY);
          ctx.lineTo(tx, topY + teethH - 1);
          ctx.stroke();
        }
      }

      // 5. Lower Teeth Row (visible in 'S', 'E', 'D', 'A')
      if (m.lowerTeeth > 0.05 && m.lipBite < 0.3) {
        const lTeethH = lerp(0, 10.5, m.lowerTeeth);
        ctx.fillStyle = '#f5f8fa';
        ctx.beginPath();
        ctx.roundRect(-halfW * 0.74, botY - lTeethH, halfW * 1.48, lTeethH + 3, [5, 5, 0, 0]);
        ctx.fill();
      }

      ctx.restore(); // end oral cavity clip

      // 6. Crisp Outline around Viseme Mouth Aperture + Corner Dimples
      ctx.strokeStyle = '#4c1620';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      if (m.round > 0.65) {
        ctx.ellipse(0, (topY + botY) * 0.5, halfW * 0.86, (botY - topY) * 0.52, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(-halfW, smileY);
        ctx.bezierCurveTo(-halfW * 0.55, topY, 0, topY, halfW, smileY);
        ctx.bezierCurveTo(halfW * 0.74, botY, -halfW * 0.74, botY, -halfW, smileY);
      }
      ctx.closePath();
      ctx.stroke();

      // For 'F' labiodental viseme, draw subtle lower-lip tuck indent lines under the upper teeth
      if (m.lipBite > 0.5) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-halfW * 0.42, botY + 2.5);
        ctx.quadraticCurveTo(0, botY + 5, halfW * 0.42, botY + 2.5);
        ctx.stroke();
      }

      // For 'Woo' / 'Oh' rounded pucker visemes, add cute side lip-pucker pleats
      if (m.round > 0.75) {
        ctx.strokeStyle = 'rgba(135, 38, 52, 0.48)';
        ctx.lineWidth = 2;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * (halfW * 0.92), (topY + botY) * 0.5 - 4);
          ctx.lineTo(side * (halfW * 1.08), (topY + botY) * 0.5);
          ctx.lineTo(side * (halfW * 0.92), (topY + botY) * 0.5 + 4);
          ctx.stroke();
        }
      }

      // 7. Lower Lip Specular Gloss Highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.beginPath();
      ctx.ellipse(-3, botY + 6, halfW * 0.25, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(halfW * 0.22, botY + 5.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Soft Under-Lip Ambient Drop Shadow + Chin Crease
    const underLipY = openH < 3.5 && m.lipBite < 0.2 ? 15 : openH * 0.68 + 12;
    ctx.fillStyle = 'rgba(184, 96, 74, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, underLipY, halfW * 0.42, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(176, 94, 72, 0.46)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, openH * 0.68 + 18, 13.5, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  _drawFrontHairBangs(ctx, w, h, now, talkBounce = 0) {
    const sway = Math.sin(now * 0.002) * 2.6;

    ctx.save();
    const bangGrad = ctx.createLinearGradient(w * 0.5, h * 0.03, w * 0.5, h * 0.44);
    bangGrad.addColorStop(0, '#2e756d');
    bangGrad.addColorStop(0.55, '#1d544f');
    bangGrad.addColorStop(1, '#123937');

    ctx.fillStyle = bangGrad;
    ctx.strokeStyle = '#0a2121';
    ctx.lineWidth = 3;

    // 1. Cute Bouncing Anime Ahoge (top hair cowlick tuft that bounces with BMO's voice!)
    const ahogeBounce = Math.sin(now * 0.004) * 0.06 + talkBounce * 0.018;
    ctx.save();
    ctx.translate(w * 0.51, h * 0.055);
    ctx.rotate(ahogeBounce);
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(-2, -32, 34, -26);
    ctx.quadraticCurveTo(10, -10, 6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. Sweeping Multi-Strand Anime Forehead Bangs & Side-Framing Locks
    ctx.beginPath();
    ctx.moveTo(w * 0.155, h * 0.42);
    ctx.bezierCurveTo(w * 0.145, h * 0.14, w * 0.32, h * 0.048, w * 0.5, h * 0.048);
    ctx.bezierCurveTo(w * 0.68, h * 0.048, w * 0.855, h * 0.14, w * 0.845, h * 0.42);
    // Right side-lock framing cheek
    ctx.quadraticCurveTo(w * 0.835 + sway * 0.3, h * 0.59, w * 0.77 + sway * 0.45, h * 0.675);
    ctx.quadraticCurveTo(w * 0.785, h * 0.46, w * 0.76, h * 0.31);
    // Layered bangs across forehead
    ctx.quadraticCurveTo(w * 0.69 + sway * 0.2, h * 0.365, w * 0.615, h * 0.245);
    ctx.quadraticCurveTo(w * 0.55 + sway * 0.25, h * 0.39, w * 0.485, h * 0.385);
    ctx.quadraticCurveTo(w * 0.44, h * 0.265, w * 0.37 + sway * 0.2, h * 0.365);
    ctx.quadraticCurveTo(w * 0.295, h * 0.245, w * 0.24, h * 0.315);
    // Left side-lock framing cheek
    ctx.quadraticCurveTo(w * 0.215, h * 0.46, w * 0.23 + sway * 0.45, h * 0.675);
    ctx.quadraticCurveTo(w * 0.165 + sway * 0.3, h * 0.59, w * 0.155, h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fine internal hair strand lines for depth
    ctx.strokeStyle = 'rgba(10, 33, 33, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.49, h * 0.12);
    ctx.quadraticCurveTo(w * 0.51, h * 0.26, w * 0.485, h * 0.38);
    ctx.moveTo(w * 0.35, h * 0.16);
    ctx.quadraticCurveTo(w * 0.36, h * 0.27, w * 0.37, h * 0.36);
    ctx.moveTo(w * 0.65, h * 0.16);
    ctx.quadraticCurveTo(w * 0.64, h * 0.26, w * 0.615, h * 0.245);
    ctx.stroke();

    // 3. Dual-Band Anime Hair Angel-Ring Specular Highlights
    ctx.fillStyle = 'rgba(178, 250, 236, 0.32)';
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.185);
    ctx.quadraticCurveTo(w * 0.5, h * 0.115, w * 0.74, h * 0.185);
    ctx.quadraticCurveTo(w * 0.5, h * 0.155, w * 0.26, h * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(220, 255, 248, 0.22)';
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.235);
    ctx.quadraticCurveTo(w * 0.5, h * 0.185, w * 0.68, h * 0.235);
    ctx.quadraticCurveTo(w * 0.5, h * 0.21, w * 0.32, h * 0.255);
    ctx.closePath();
    ctx.fill();

    // 4. Signature BMO Gold D-Pad Hair Clip on Left Side Lock
    ctx.save();
    ctx.translate(w * 0.255, h * 0.285);
    ctx.rotate(-0.26);
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#4a2e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-13, -4.5, 26, 9, 3);
    ctx.roundRect(-4.5, -13, 9, 26, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff5cc';
    ctx.beginPath();
    ctx.arc(-2, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}
