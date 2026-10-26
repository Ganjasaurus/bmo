const GALLERY_KEY = 'bmo-local-image-gallery-v1';

export const IMAGE_STYLES = [
  { id: 'anime', label: 'Anime Studio' },
  { id: 'ghibli', label: 'Dreamy Meadow' },
  { id: 'cyberpunk', label: 'Neon Cyber' },
  { id: 'pixel', label: '16-Bit Pixel' },
  { id: 'watercolor', label: 'Storybook Ink' },
];

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || 'bmo');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedInt) {
  let a = (seedInt >>> 0) || 1337;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function detectImageRequest(promptText) {
  const clean = String(promptText || '').trim();
  const match = clean.match(
    /^(?:(?:hey\s+|hi\s+)?bmo[\s,]*)?(?:please\s+)?(?:can\s+you\s+|could\s+you\s+)?(?:draw|paint|sketch|illustrate|generate\s+(?:an?\s+)?(?:image|picture|art)|make\s+(?:an?\s+)?(?:image|picture|drawing|painting)|create\s+(?:an?\s+)?(?:image|picture|art))\s+(?:me\s+)?(?:of\s+|a\s+|an\s+)?(.+)$/i
  );
  if (!match) return null;
  return match[1].replace(/[.!?]+$/, '').trim();
}

export function parsePromptScene(promptText, styleId = 'anime', seed = null) {
  const lower = String(promptText || 'magical emerald sunset over crystal mountains').toLowerCase();
  const actualSeed = seed != null ? Number(seed) : hashSeed(`${lower}:${styleId}:${Date.now() % 997}`);
  const rng = createRng(actualSeed);

  // Determine time of day / palette
  let palette = {
    skyTop: '#162347',
    skyMid: '#4c4c8d',
    skyBot: '#f38679',
    sunColor: '#ffe9a8',
    farHill: '#2e335c',
    midHill: '#1d2747',
    nearGround: '#131d36',
    accent: '#63f5d6',
    glow: 'rgba(255, 200, 145, 0.45)',
  };

  if (/\b(night|space|galaxy|star|moon|midnight|cosmic|nebula)\b/.test(lower)) {
    palette = {
      skyTop: '#070b1c',
      skyMid: '#181e46',
      skyBot: '#392e6e',
      sunColor: '#e8f4ff',
      farHill: '#191d3d',
      midHill: '#10152e',
      nearGround: '#090d1f',
      accent: '#7df9ff',
      glow: 'rgba(130, 210, 255, 0.4)',
    };
  } else if (/\b(sunset|dusk|evening|golden|warm|autumn|fire|dragon)\b/.test(lower)) {
    palette = {
      skyTop: '#231640',
      skyMid: '#8a3260',
      skyBot: '#ff9654',
      sunColor: '#fff2b2',
      farHill: '#471e46',
      midHill: '#2d1533',
      nearGround: '#170b21',
      accent: '#ffcf6b',
      glow: 'rgba(255, 160, 90, 0.5)',
    };
  } else if (/\b(forest|meadow|nature|tree|garden|spring|ghibli|emerald|frog)\b/.test(lower) || styleId === 'ghibli') {
    palette = {
      skyTop: '#3a88d4',
      skyMid: '#7bc6ef',
      skyBot: '#dcf7e3',
      sunColor: '#fffbe0',
      farHill: '#4f9c8c',
      midHill: '#2f7a67',
      nearGround: '#1a4f43',
      accent: '#a8ff8e',
      glow: 'rgba(210, 255, 190, 0.45)',
    };
  } else if (/\b(cyber|neon|city|synth|robot|future|laser)\b/.test(lower) || styleId === 'cyberpunk') {
    palette = {
      skyTop: '#090418',
      skyMid: '#280b45',
      skyBot: '#c72483',
      sunColor: '#ff3898',
      farHill: '#1d0b36',
      midHill: '#120726',
      nearGround: '#080314',
      accent: '#00f6ff',
      glow: 'rgba(0, 246, 255, 0.48)',
    };
  } else if (/\b(ocean|sea|water|beach|island|whale|fish)\b/.test(lower)) {
    palette = {
      skyTop: '#1c5d99',
      skyMid: '#5ab1d8',
      skyBot: '#ffd6a5',
      sunColor: '#fff6cc',
      farHill: '#1d6c8c',
      midHill: '#114b66',
      nearGround: '#0a2e42',
      accent: '#7bf2e6',
      glow: 'rgba(130, 245, 235, 0.45)',
    };
  }

  // Detect primary focal subject
  let subject = 'character';
  if (/\b(cat|kitten|neko|fox|dog|puppy|bunny|rabbit|pet)\b/.test(lower)) subject = 'cat';
  else if (/\b(robot|bmo|mecha|android|bot|console)\b/.test(lower)) subject = 'bmo';
  else if (/\b(castle|tower|temple|shrine|house|village|city)\b/.test(lower)) subject = 'castle';
  else if (/\b(dragon|monster|phoenix|bird)\b/.test(lower)) subject = 'dragon';
  else if (/\b(tree|flower|rose|sakura|cherry|blossom|forest)\b/.test(lower)) subject = 'sakura';
  else if (/\b(ship|boat|rocket|spaceship|ufo)\b/.test(lower)) subject = 'spaceship';

  const hasWater = /\b(ocean|sea|lake|river|water|beach|reflection)\b/.test(lower) || rng() < 0.45;
  const hasStars = /\b(night|space|star|galaxy|moon|nebula|magic)\b/.test(lower) || rng() < 0.6;

  return {
    prompt: promptText,
    styleId,
    seed: actualSeed,
    palette,
    subject,
    hasWater,
    hasStars,
  };
}

function drawFocalSubject(ctx, w, h, scene, rng) {
  const { subject, palette } = scene;
  const cx = w * 0.5;
  const cy = h * 0.62;

  ctx.save();
  if (subject === 'bmo') {
    // Stylized Anime BMO Companion in the scene
    ctx.translate(cx, cy);
    ctx.fillStyle = '#53bfa9';
    ctx.strokeStyle = '#113832';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-62, -75, 124, 140, 20);
    ctx.fill();
    ctx.stroke();

    // Screen
    ctx.fillStyle = '#b4f5e4';
    ctx.beginPath();
    ctx.roundRect(-46, -58, 92, 68, 12);
    ctx.fill();
    ctx.stroke();

    // Cute Anime Eyes & Smile on BMO
    ctx.fillStyle = '#122926';
    ctx.beginPath();
    ctx.arc(-20, -30, 6.5, 0, Math.PI * 2);
    ctx.arc(20, -30, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-22, -32, 2.3, 0, Math.PI * 2);
    ctx.arc(18, -32, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#122926';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -22, 11, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // D-pad & Buttons
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-34, 26, 22, 7);
    ctx.fillRect(-26.5, 18.5, 7, 22);
    ctx.fillStyle = '#e84868';
    ctx.beginPath();
    ctx.arc(24, 34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38d478';
    ctx.beginPath();
    ctx.arc(6, 24, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (subject === 'cat') {
    // Anime Spirit Cat Silhouette with Glowing Eyes & Tail
    ctx.translate(cx, cy + 12);
    ctx.fillStyle = '#14182b';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 22, 38, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head + Ears
    ctx.beginPath();
    ctx.arc(0, -30, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-26, -42);
    ctx.lineTo(-34, -76);
    ctx.lineTo(-8, -54);
    ctx.moveTo(26, -42);
    ctx.lineTo(34, -76);
    ctx.lineTo(8, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Anime Cat Eyes
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(-11, -30, 6, 4.5, 0.2, 0, Math.PI * 2);
    ctx.ellipse(11, -30, 6, 4.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Curving Tail
    ctx.strokeStyle = '#14182b';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, 48);
    ctx.bezierCurveTo(75, 40, 82, -10, 56, -25);
    ctx.stroke();
  } else if (subject === 'castle') {
    // Floating Miyazaki / Fantasy Spire Castle
    ctx.translate(cx, cy - 18);
    ctx.fillStyle = '#181d38';
    ctx.strokeStyle = palette.sunColor;
    ctx.lineWidth = 2;
    const towers = [
      { x: -55, w: 26, h: 90 },
      { x: -24, w: 34, h: 125 },
      { x: 14, w: 28, h: 105 },
      { x: -8, w: 22, h: 155 },
    ];
    for (const t of towers) {
      ctx.fillRect(t.x, 45 - t.h, t.w, t.h);
      ctx.beginPath();
      ctx.moveTo(t.x - 5, 45 - t.h);
      ctx.lineTo(t.x + t.w / 2, 45 - t.h - 32);
      ctx.lineTo(t.x + t.w + 5, 45 - t.h);
      ctx.closePath();
      ctx.fill();
    }
    // Warm lit windows
    ctx.fillStyle = '#ffe28a';
    for (let i = 0; i < 9; i++) {
      const wx = -42 + (i % 3) * 32;
      const wy = -40 + Math.floor(i / 3) * 24;
      ctx.fillRect(wx, wy, 6, 10);
    }
  } else if (subject === 'sakura') {
    // Blossoming Anime Sakura Tree on Hilltop
    ctx.translate(cx, cy + 35);
    ctx.strokeStyle = '#2d1826';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.quadraticCurveTo(-8, -15, -28, -58);
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(22, -38, 48, -64);
    ctx.stroke();

    // Lush pink blossom clouds
    const puffs = [
      { x: -45, y: -72, r: 42 },
      { x: 0, y: -92, r: 52 },
      { x: 48, y: -74, r: 44 },
      { x: -18, y: -56, r: 38 },
      { x: 26, y: -54, r: 38 },
    ];
    for (const p of puffs) {
      const g = ctx.createRadialGradient(p.x, p.y - 8, 4, p.x, p.y, p.r);
      g.addColorStop(0, '#ffdbe8');
      g.addColorStop(0.65, '#ff8eb8');
      g.addColorStop(1, 'rgba(230, 85, 140, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Heroic Anime Traveler Silhouette Looking at the Horizon
    ctx.translate(cx, cy + 20);
    ctx.fillStyle = '#121629';
    // Flowing scarf / cloak in the wind
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.quadraticCurveTo(-68, -10 + rng() * 12, -92, 16);
    ctx.quadraticCurveTo(-48, 22, -10, 4);
    ctx.closePath();
    ctx.fillStyle = palette.accent;
    ctx.fill();

    // Head & Torso silhouette
    ctx.fillStyle = '#121629';
    ctx.beginPath();
    ctx.arc(0, -44, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-22, 52);
    ctx.lineTo(-16, -22);
    ctx.lineTo(16, -22);
    ctx.lineTo(22, 52);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Progressively renders an 8-step local artwork onto `canvas`, invoking `onStep(step, totalSteps)`
 * so the user watches the image materialize step-by-step.
 */
export async function generateLocalArtwork(canvas, promptText, { styleId = 'anime', seed = null, onStep } = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const w = canvas.width || 512;
  const h = canvas.height || 512;

  const scene = parsePromptScene(promptText, styleId, seed);
  const rng = createRng(scene.seed);
  const { palette } = scene;
  const totalSteps = 8;

  const pauseStep = async (step, label) => {
    onStep?.({ step, totalSteps, label, scene });
    await new Promise((r) => setTimeout(r, 55));
  };

  // Step 1: Latent Sky & Atmospheric Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.75);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.52, palette.skyMid);
  skyGrad.addColorStop(1, palette.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);
  await pauseStep(1, 'Synthesizing sky & atmosphere…');

  // Step 2: Celestial Sun / Moon & Starfield
  if (scene.hasStars) {
    ctx.save();
    for (let i = 0; i < 65; i++) {
      const sx = rng() * w;
      const sy = rng() * h * 0.55;
      const sr = 0.7 + rng() * 2.1;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + rng() * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const sunX = w * (0.32 + rng() * 0.36);
  const sunY = h * (0.24 + rng() * 0.16);
  const sunR = 46 + rng() * 28;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.6);
  sunGlow.addColorStop(0, palette.sunColor);
  sunGlow.addColorStop(0.45, palette.glow);
  sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.sunColor;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  await pauseStep(2, 'Rendering celestial light & stars…');

  // Step 3: Volumetric Anime Clouds
  ctx.save();
  for (let c = 0; c < 5; c++) {
    const cx = (c / 4) * w + (rng() - 0.5) * 60;
    const cy = h * (0.22 + rng() * 0.25);
    const cw = 90 + rng() * 80;
    const ch = 24 + rng() * 22;
    const cGrad = ctx.createLinearGradient(cx, cy - ch, cx, cy + ch);
    cGrad.addColorStop(0, 'rgba(255, 252, 245, 0.55)');
    cGrad.addColorStop(1, 'rgba(255, 200, 210, 0.08)');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  await pauseStep(3, 'Sculpting volumetric clouds…');

  // Step 4: Distant Mountain Ridges & Horizon Depth
  const drawRidge = (baseY, amp, color, roughness) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    let y = baseY;
    for (let x = 0; x <= w; x += 16) {
      y = baseY + Math.sin(x * 0.012 + rng() * 0.5) * amp + (rng() - 0.5) * roughness;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };

  drawRidge(h * 0.56, 38, palette.farHill, 18);
  drawRidge(h * 0.65, 26, palette.midHill, 14);
  await pauseStep(4, 'Building horizon & mountain depth…');

  // Step 5: Shimmering Water / Foreground Meadow
  if (scene.hasWater) {
    const waterTop = h * 0.72;
    const wGrad = ctx.createLinearGradient(0, waterTop, 0, h);
    wGrad.addColorStop(0, palette.midHill);
    wGrad.addColorStop(0.5, palette.skyMid);
    wGrad.addColorStop(1, palette.nearGround);
    ctx.fillStyle = wGrad;
    ctx.fillRect(0, waterTop, w, h - waterTop);

    // Sun shimmer ripples on water
    ctx.fillStyle = palette.sunColor;
    for (let r = 0; r < 22; r++) {
      const ry = waterTop + 8 + (r / 22) * (h - waterTop - 14);
      const rw = (1 - r / 28) * 65 + rng() * 20;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(sunX - rw / 2 + (rng() - 0.5) * 18, ry, rw, 2.5);
    }
    ctx.globalAlpha = 1;
  }
  drawRidge(h * 0.78, 18, palette.nearGround, 8);
  await pauseStep(5, 'Painting foreground & reflections…');

  // Step 6: Primary Focal Subject
  drawFocalSubject(ctx, w, h, scene, rng);
  await pauseStep(6, 'Detailing focal subject…');

  // Step 7: Glowing Fireflies / Bokeh / Sakura Petals
  ctx.save();
  for (let p = 0; p < 28; p++) {
    const px = rng() * w;
    const py = h * 0.25 + rng() * h * 0.72;
    const pr = 2 + rng() * 4.5;
    ctx.fillStyle = p % 2 === 0 ? palette.accent : palette.sunColor;
    ctx.globalAlpha = 0.35 + rng() * 0.55;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  await pauseStep(7, 'Adding rim light & bokeh particles…');

  // Step 8: Style Post-Processing (16-Bit Pixelation or Storybook Ink Frame)
  if (styleId === 'pixel') {
    const scale = 6;
    const sw = Math.floor(w / scale);
    const sh = Math.floor(h / scale);
    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(canvas, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  } else if (styleId === 'watercolor') {
    ctx.strokeStyle = 'rgba(255, 248, 235, 0.85)';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
  }

  await pauseStep(8, 'Complete!');
  return {
    prompt: scene.prompt,
    styleId: scene.styleId,
    seed: scene.seed,
    dataUrl: typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : '',
  };
}

export function loadSavedGallery() {
  try {
    const raw = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveToGallery(item) {
  try {
    const existing = loadSavedGallery().filter((x) => x.seed !== item.seed);
    const next = [item, ...existing].slice(0, 6);
    localStorage.setItem(GALLERY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
