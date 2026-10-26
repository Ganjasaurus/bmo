// Web Canvas port of BmoGui & EyeController (H:\AI\scripts\face\gui.py & eyes.py)
import { FACE_NAMES } from './visemes.js?v=1';

export class BmoFaceController {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentFace = 'Neutral';
    this.eyeState = 'open'; // 'open' | 'closed'
    this.faces = new Map();
    this.eyes = { open: null, closed: null };
    this._blinkTimer = null;
    this._openTimer = null;
    this._disposed = false;
    this.ready = false;

    this.canvas.dataset.viseme = 'Neutral';
    this.canvas.dataset.eyes = 'open';
  }

  async loadSprites(basePath = './assets/face') {
    const loadImg = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
        img.src = src;
      });

    const facePromises = FACE_NAMES.map(async (name) => {
      const img = await loadImg(`${basePath}/${name}.png`);
      this.faces.set(name, img);
    });

    const [openImg, closedImg] = await Promise.all([
      loadImg(`${basePath}/eyesopen.png`),
      loadImg(`${basePath}/eyesclosed.png`),
      ...facePromises,
    ]);

    this.eyes.open = openImg;
    this.eyes.closed = closedImg;
    this.ready = true;
    this.render();
    this.scheduleBlink();
    return true;
  }

  setFace(name) {
    const target = this.faces.has(name) ? name : 'Neutral';
    if (this.currentFace === target && this.canvas.dataset.viseme === target) return;
    this.currentFace = target;
    this.canvas.dataset.viseme = target;
    this.render();
  }

  setEyes(state) {
    const next = state === 'closed' ? 'closed' : 'open';
    if (this.eyeState === next) return;
    this.eyeState = next;
    this.canvas.dataset.eyes = next;
    this.render();
  }

  scheduleBlink() {
    if (this._disposed) return;
    clearTimeout(this._blinkTimer);
    // Exact blink interval from H:\AI\scripts\face\eyes.py: random.randint(2500, 6000) ms
    const delay = 2500 + Math.floor(Math.random() * 3500);
    this._blinkTimer = setTimeout(() => this.blink(), delay);
  }

  blink() {
    if (this._disposed) return;
    this._blinkTimer = null;
    this.setEyes('closed');
    // Exact 100ms blink duration from H:\AI\scripts\face\eyes.py
    this._openTimer = setTimeout(() => {
      this._openTimer = null;
      this.setEyes('open');
      this.scheduleBlink();
    }, 100);
  }

  render() {
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    this.ctx.fillStyle = '#ffceb3';
    this.ctx.fillRect(0, 0, width, height);

    const faceImg = this.faces.get(this.currentFace) || this.faces.get('Neutral');
    if (faceImg) {
      this.ctx.drawImage(faceImg, 0, 0, width, height);
    }

    const eyeImg = this.eyeState === 'closed' ? this.eyes.closed : this.eyes.open;
    if (eyeImg) {
      this.ctx.drawImage(eyeImg, 0, 0, width, height);
    }
  }

  dispose() {
    this._disposed = true;
    clearTimeout(this._blinkTimer);
    clearTimeout(this._openTimer);
  }
}
