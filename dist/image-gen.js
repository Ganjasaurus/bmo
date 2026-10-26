const GALLERY_KEY = 'bmo-local-image-gallery-v1';

export const IMAGE_STYLES = [
  { id: 'anime', label: 'Anime Studio' },
  { id: 'ghibli', label: 'Dreamy Meadow' },
  { id: 'cyberpunk', label: 'Neon Cyber' },
  { id: 'pixel', label: '16-Bit Pixel' },
  { id: 'watercolor', label: 'Storybook Ink' },
];

export const IMAGE_PRESETS = [
  { label: 'Anime Heroine', prompt: 'Anime heroine portrait under starry twilight sky', styleId: 'anime' },
  { label: 'BMO Forest', prompt: 'BMO in a glowing emerald forest at sunset', styleId: 'anime' },
  { label: 'Cyber City', prompt: 'Neon cyberpunk city skyline at night with rain', styleId: 'cyberpunk' },
  { label: 'Sakura Shrine', prompt: 'Blossoming sakura cherry tree by a mystical moonlit lake', styleId: 'ghibli' },
  { label: 'Spirit Cat', prompt: 'Magical anime spirit cat under starry galaxy sky', styleId: 'anime' },
  { label: 'Sky Dragon', prompt: 'Golden dragon soaring across sunset clouds', styleId: 'anime' },
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

  let resolvedStyle = styleId;
  if (styleId === 'auto') {
    if (/\b(cyber|neon|synth|future|laser)\b/.test(lower)) resolvedStyle = 'cyberpunk';
    else if (/\b(pixel|retro|8bit|16bit|arcade)\b/.test(lower)) resolvedStyle = 'pixel';
    else if (/\b(meadow|ghibli|forest|spring)\b/.test(lower)) resolvedStyle = 'ghibli';
    else if (/\b(watercolor|ink|storybook|sketch)\b/.test(lower)) resolvedStyle = 'watercolor';
    else resolvedStyle = 'anime';
  }

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

  if (/\b(cyber|neon|synth|laser)\b/.test(lower) || resolvedStyle === 'cyberpunk') {
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
  } else if (/\b(night|space|galaxy|star|moon|midnight|cosmic|nebula)\b/.test(lower)) {
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
  } else if (/\b(forest|meadow|nature|tree|garden|spring|ghibli|emerald|frog)\b/.test(lower) || resolvedStyle === 'ghibli') {
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
  if (/\b(cat|kitten|neko|fox|kitsune|dog|puppy|bunny|rabbit|pet|wolf)\b/.test(lower)) subject = 'cat';
  else if (/\b(robot|bmo|mecha|android|bot|console|gameboy)\b/.test(lower)) subject = 'bmo';
  else if (/\b(castle|tower|temple|shrine|house|village|city|skyline)\b/.test(lower)) subject = 'castle';
  else if (/\b(dragon|monster|phoenix|bird|wyvern)\b/.test(lower)) subject = 'dragon';
  else if (/\b(tree|flower|rose|sakura|cherry|blossom|forest)\b/.test(lower)) subject = 'sakura';
  else if (/\b(ship|boat|rocket|spaceship|ufo|starship)\b/.test(lower)) subject = 'spaceship';

  // Detect weather / atmospheric effect
  let weather = 'fireflies';
  if (/\b(rain|storm|drizzle|cyber|neon)\b/.test(lower)) weather = 'rain';
  else if (/\b(snow|winter|ice|frost|blizzard)\b/.test(lower)) weather = 'snow';
  else if (/\b(sakura|cherry|blossom|petal|spring)\b/.test(lower)) weather = 'petals';
  else if (/\b(meteor|comet|shooting\s+star|galaxy|space)\b/.test(lower)) weather = 'meteors';

  const hasWater = /\b(ocean|sea|lake|river|water|beach|reflection|rain)\b/.test(lower) || rng() < 0.48;
  const hasStars = /\b(night|space|star|galaxy|moon|nebula|magic|cyber)\b/.test(lower) || rng() < 0.62;

  return {
    prompt: promptText,
    styleId: resolvedStyle,
    style: resolvedStyle,
    seed: actualSeed,
    palette,
    subject,
    weather,
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
    // Stylized Anime BMO Companion with Glowing Screen & Floating Pixel Hearts
    ctx.translate(cx, cy);
    ctx.fillStyle = '#53bfa9';
    ctx.strokeStyle = '#113832';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-64, -76, 128, 142, 22);
    ctx.fill();
    ctx.stroke();

    // Glowing Mint Screen
    const scrGrad = ctx.createLinearGradient(0, -60, 0, 12);
    scrGrad.addColorStop(0, '#c8fff0');
    scrGrad.addColorStop(1, '#94ebd6');
    ctx.fillStyle = scrGrad;
    ctx.beginPath();
    ctx.roundRect(-48, -58, 96, 70, 13);
    ctx.fill();
    ctx.stroke();

    // Cute Anime Eyes, Blush & Smile on BMO
    ctx.fillStyle = 'rgba(255, 118, 136, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-30, -18, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(30, -18, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#122926';
    ctx.beginPath();
    ctx.arc(-20, -29, 7, 0, Math.PI * 2);
    ctx.arc(20, -29, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-22.5, -31.5, 2.6, 0, Math.PI * 2);
    ctx.arc(17.5, -31.5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#122926';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -21, 11, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // D-pad & Arcade Buttons
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-35, 26, 22, 7);
    ctx.fillRect(-27.5, 18.5, 7, 22);
    ctx.fillStyle = '#e84868';
    ctx.beginPath();
    ctx.arc(25, 34, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38d478';
    ctx.beginPath();
    ctx.arc(6, 24, 6.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (subject === 'cat') {
    // Mystical Anime Spirit Cat / Kitsune Silhouette with Glowing Eyes & Twin Tails
    ctx.translate(cx, cy + 12);
    ctx.fillStyle = '#13172b';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(0, 22, 38, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -30, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-26, -42);
    ctx.lineTo(-35, -78);
    ctx.lineTo(-8, -54);
    ctx.moveTo(26, -42);
    ctx.lineTo(35, -78);
    ctx.lineTo(8, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Jewel Cat Eyes
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(-11, -30, 6.5, 4.5, 0.2, 0, Math.PI * 2);
    ctx.ellipse(11, -30, 6.5, 4.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Curving Spirit Tail with Glowing Tip
    ctx.strokeStyle = '#13172b';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, 48);
    ctx.bezierCurveTo(78, 40, 84, -12, 56, -28);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(56, -28, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (subject === 'dragon') {
    // Soaring Anime Sky Dragon Coiled Across the Moon/Sun
    ctx.translate(cx, cy - 55);
    ctx.strokeStyle = '#16182e';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-110, 65);
    ctx.bezierCurveTo(-55, -45, 35, 55, 95, -35);
    ctx.stroke();

    // Luminous dorsal scale ridge
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(-105, 58);
    ctx.bezierCurveTo(-55, -52, 35, 48, 95, -42);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dragon Head & Antlers
    ctx.fillStyle = '#16182e';
    ctx.beginPath();
    ctx.ellipse(100, -38, 22, 13, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.sunColor;
    ctx.beginPath();
    ctx.arc(105, -41, 3.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (subject === 'spaceship') {
    // Sleek Anime Starcruiser with Glowing Thruster Plume
    ctx.translate(cx, cy - 35);
    ctx.rotate(-0.22);

    // Thruster flame
    const flameGrad = ctx.createLinearGradient(-95, 0, -25, 0);
    flameGrad.addColorStop(0, 'rgba(0, 246, 255, 0)');
    flameGrad.addColorStop(0.6, palette.accent);
    flameGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-25, -10);
    ctx.lineTo(-105, 0);
    ctx.lineTo(-25, 10);
    ctx.closePath();
    ctx.fill();

    // Hull & Swept Wings
    ctx.fillStyle = '#1b243b';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(65, 0);
    ctx.lineTo(-28, -34);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-32, 0);
    ctx.lineTo(-14, 8);
    ctx.lineTo(-28, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Canopy
    ctx.fillStyle = palette.sunColor;
    ctx.beginPath();
    ctx.ellipse(16, 0, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (subject === 'castle') {
    // Floating Miyazaki / Cyberpunk Spire Skyline
    ctx.translate(cx, cy - 18);
    ctx.fillStyle = '#151933';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    const towers = [
      { x: -72, w: 28, h: 95 },
      { x: -38, w: 34, h: 135 },
      { x: 2, w: 30, h: 165 },
      { x: 38, w: 32, h: 115 },
    ];
    for (const t of towers) {
      ctx.fillRect(t.x, 45 - t.h, t.w, t.h);
      ctx.strokeRect(t.x, 45 - t.h, t.w, t.h);
      ctx.beginPath();
      ctx.moveTo(t.x - 4, 45 - t.h);
      ctx.lineTo(t.x + t.w / 2, 45 - t.h - 30);
      ctx.lineTo(t.x + t.w + 4, 45 - t.h);
      ctx.closePath();
      ctx.fill();
    }
    // Warm lit windows & neon signs
    ctx.fillStyle = '#ffe58f';
    for (const t of towers) {
      for (let wy = 45 - t.h + 14; wy < 36; wy += 18) {
        ctx.fillRect(t.x + 6, wy, 5, 8);
        ctx.fillRect(t.x + t.w - 11, wy, 5, 8);
      }
    }
  } else if (subject === 'sakura') {
    // Blossoming Anime Sakura Tree + Torii Gate Hint
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

    const puffs = [
      { x: -45, y: -72, r: 44 },
      { x: 0, y: -94, r: 54 },
      { x: 48, y: -74, r: 46 },
      { x: -18, y: -56, r: 40 },
      { x: 26, y: -54, r: 40 },
    ];
    for (const p of puffs) {
      const g = ctx.createRadialGradient(p.x, p.y - 8, 4, p.x, p.y, p.r);
      g.addColorStop(0, '#ffe3ee');
      g.addColorStop(0.65, '#ff8eb8');
      g.addColorStop(1, 'rgba(230, 85, 140, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Detailed Anime Heroine Bust Portrait with Jewel Eyes & Wind-Swept Hair
    ctx.translate(cx, cy + 16);

    // Back wind-swept hair
    ctx.fillStyle = '#18423f';
    ctx.beginPath();
    ctx.moveTo(-48, -55);
    ctx.bezierCurveTo(-55, -105, 55, -105, 48, -55);
    ctx.bezierCurveTo(66, -10, 74, 35, 45, 52);
    ctx.lineTo(-45, 52);
    ctx.bezierCurveTo(-68, 35, -62, -10, -48, -55);
    ctx.closePath();
    ctx.fill();

    // Glowing wind-swept scarf
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-78, 12 + rng() * 10, -110, 38);
    ctx.quadraticCurveTo(-55, 44, -10, 22);
    ctx.closePath();
    ctx.fill();

    // Shoulders / Cloak
    ctx.fillStyle = '#12182b';
    ctx.beginPath();
    ctx.moveTo(-46, 62);
    ctx.quadraticCurveTo(0, 12, 46, 62);
    ctx.closePath();
    ctx.fill();

    // Sculpted Anime Face
    ctx.fillStyle = '#ffe3cf';
    ctx.strokeStyle = '#52271d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-36, -56);
    ctx.bezierCurveTo(-36, -92, 36, -92, 36, -56);
    ctx.bezierCurveTo(36, -28, 22, -6, 0, -2);
    ctx.bezierCurveTo(-22, -6, -36, -28, -36, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Emerald Anime Eyes with White Catchlights
    for (const side of [-1, 1]) {
      const ex = side * 14;
      const ey = -42;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 8.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#24b868';
      ctx.beginPath();
      ctx.arc(ex, ey, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1c18';
      ctx.beginPath();
      ctx.arc(ex, ey, 3.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2, ey - 2, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#12131c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 8.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    // Cheek Blush & Smile
    ctx.fillStyle = 'rgba(255, 110, 130, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-20, -31, 6.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(20, -31, 6.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b84250';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -23, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Front Hair Bangs & Angel Ring
    ctx.fillStyle = '#24665f';
    ctx.beginPath();
    ctx.moveTo(-40, -48);
    ctx.bezierCurveTo(-40, -96, 40, -96, 40, -48);
    ctx.quadraticCurveTo(22, -62, 8, -48);
    ctx.quadraticCurveTo(0, -65, -10, -48);
    ctx.quadraticCurveTo(-24, -62, -40, -48);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawWeatherEffects(ctx, w, h, scene, rng) {
  const { weather, palette } = scene;
  ctx.save();
  if (weather === 'rain') {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 55; i++) {
      const rx = rng() * w;
      const ry = rng() * h;
      const len = 14 + rng() * 18;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + len);
      ctx.stroke();
    }
  } else if (weather === 'petals') {
    for (let i = 0; i < 36; i++) {
      const px = rng() * w;
      const py = rng() * h;
      const pr = 3 + rng() * 4.5;
      ctx.fillStyle = i % 2 === 0 ? '#ffd1e3' : '#ff94b8';
      ctx.globalAlpha = 0.65 + rng() * 0.3;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.55, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'meteors') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const mx = w * (0.2 + rng() * 0.65);
      const my = h * (0.08 + rng() * 0.28);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - 48, my + 24);
      ctx.stroke();
    }
  } else {
    // Glowing fireflies & bokeh
    for (let p = 0; p < 30; p++) {
      const px = rng() * w;
      const py = h * 0.22 + rng() * h * 0.74;
      const pr = 2 + rng() * 4.8;
      ctx.fillStyle = p % 2 === 0 ? palette.accent : palette.sunColor;
      ctx.globalAlpha = 0.35 + rng() * 0.55;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
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
    await new Promise((r) => setTimeout(r, 48));
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
    for (let i = 0; i < 70; i++) {
      const sx = rng() * w;
      const sy = rng() * h * 0.55;
      const sr = 0.7 + rng() * 2.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + rng() * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const sunX = w * (0.32 + rng() * 0.36);
  const sunY = h * (0.24 + rng() * 0.16);
  const sunR = 48 + rng() * 28;
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

  // Step 7: Weather & Atmospheric Particles (Rain, Sakura Petals, Meteors, or Fireflies)
  drawWeatherEffects(ctx, w, h, scene, rng);
  await pauseStep(7, 'Adding weather & rim-light particles…');

  // Step 8: Style Post-Processing (16-Bit Pixelation or Storybook Ink Frame)
  if (scene.styleId === 'pixel') {
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
  } else if (scene.styleId === 'watercolor') {
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
