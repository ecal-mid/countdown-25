import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);

// ==================== CONFIG / STATE ====================
const CONFIG = {
  eyeRadius: 320,
  pupilRadius: 180,
  strokeWidth: 13,
  eyeGap: 480,
  teethWidth: 250,
  teethHeight: 500,
  slideInDuration: 1500,
  slideInDistanceOffset: 200,
  colorTransitionDuration: 1000,
  eyesFadeDuration: 1000,
  ceroFadeDuration: 1000,
  blinkInterval: 3000,
  blinkDuration: 150,
};

// computed
const totalEyeWidth = CONFIG.eyeRadius * 2 * 2 + CONFIG.eyeGap;
const eyeY = canvas.height / 2 - 300;
const eye1X = (canvas.width - totalEyeWidth) / 2 + CONFIG.eyeRadius;
const eye2X = eye1X + CONFIG.eyeRadius * 2 + CONFIG.eyeGap;

// ==================== ASSETS ====================

// Teeth images
const teethImages = {
  intact: "assets-0/TEETH.svg",
  broken05: "assets-0/TEETH-BROKEN-05.svg",
  broken06: "assets-0/TEETH-BROKEN-06.svg",
  broken07: "assets-0/TEETH-BROKEN-07.svg",
  broken08: "assets-0/TEETH-BROKEN-08.svg",
};

// Audio (adapt this path to your project)
const TEETH_SOUND_SRC = "assets-0/punch-sound.mp3";

// Single Audio instance for teeth sound
const teethSound = new Audio(TEETH_SOUND_SRC);
teethSound.volume = 0.8; // adjust if needed

function playTeethSound() {
  try {
    teethSound.currentTime = 0;
  } catch (e) {
    // ignore if not ready yet
  }
  const playPromise = teethSound.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {
      // ignore autoplay errors
    });
  }
}

// Preload images and expose ready flag
const images = {
  teeth: [],
  ready: false,
};

function loadTeethImages(map) {
  const keys = [null, "broken05", "broken06", "broken07", "broken08"];
  let loaded = 0;
  const total = keys.length - 1; // ignore index 0

  keys.forEach((k, i) => {
    if (i === 0) {
      images.teeth[i] = null;
      return;
    }
    const img = new Image();
    img.src = map[k];
    img.onload = () => {
      loaded += 1;
      if (loaded === total) images.ready = true;
    };
    img.onerror = () => {
      // still count it so the scene isn't blocked forever
      loaded += 1;
      if (loaded === total) images.ready = true;
    };
    images.teeth[i] = img;
  });
}

loadTeethImages(teethImages);

// ==================== STATE ====================
let state = {
  teethStateTop: 1, // 0..4, 5 means gone
  teethStateBottom: 1,
  colorTransitionStart: null,
  eyesFadeStart: null,
  ceroFadeStart: null,
  slideInStartTime: null,
  blinkStartTime: Date.now(),
};

// -------------------- Utilities --------------------
function now() {
  return Date.now();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function isPointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// Interpolate hex colors (#rrggbbaa or #rrggbb)
function interpolateColorHex(c1, c2, t) {
  const s1 = c1.replace(/^#/, "");
  const s2 = c2.replace(/^#/, "");

  const parseChannel = (s, i) => parseInt(s.slice(i, i + 2), 16);

  const r = Math.round(
    parseChannel(s1, 0) + (parseChannel(s2, 0) - parseChannel(s1, 0)) * t
  );
  const g = Math.round(
    parseChannel(s1, 2) + (parseChannel(s2, 2) - parseChannel(s1, 2)) * t
  );
  const b = Math.round(
    parseChannel(s1, 4) + (parseChannel(s2, 4) - parseChannel(s1, 4)) * t
  );

  const a1 = s1.length === 8 ? parseInt(s1.slice(6, 8), 16) / 255 : 1;
  const a2 = s2.length === 8 ? parseInt(s2.slice(6, 8), 16) / 255 : 1;
  const a = a1 + (a2 - a1) * t;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Slide-in offset (ease-out cubic)
function getSlideInOffset() {
  if (state.slideInStartTime === null) state.slideInStartTime = now();
  const elapsed = now() - state.slideInStartTime;
  const duration = CONFIG.slideInDuration;
  const progress = clamp(elapsed / duration, 0, 1);
  const ease = 1 - Math.pow(1 - progress, 3);
  return (canvas.width + CONFIG.slideInDistanceOffset) * (1 - ease);
}

// -------------------- Blink --------------------
function getBlinkAmount() {
  const elapsed = (now() - state.blinkStartTime) % CONFIG.blinkInterval;
  if (elapsed < CONFIG.blinkDuration) {
    const half = CONFIG.blinkDuration / 2;
    const p = elapsed / half;
    return p < 1 ? p : 2 - p; // 0->1->0
  }
  return 0;
}

// -------------------- Geometry helpers for teeth --------------------
function teethXTop() {
  return canvas.width / 2 - CONFIG.teethWidth / 2;
}
function teethYTop() {
  return canvas.height / 2 - 800;
}
function teethXBottom() {
  return canvas.width / 2 - CONFIG.teethWidth / 2;
}
function teethYBottom() {
  return canvas.height / 2 + 300;
}

function isClickInTeethTop(mx, my) {
  return isPointInRect(
    mx,
    my,
    teethXTop(),
    teethYTop(),
    CONFIG.teethWidth,
    CONFIG.teethHeight
  );
}
function isClickInTeethBottom(mx, my) {
  return isPointInRect(
    mx,
    my,
    teethXBottom(),
    teethYBottom(),
    CONFIG.teethWidth,
    CONFIG.teethHeight
  );
}

// -------------------- Input handling --------------------
function handleInput() {
  if (!input.isDown()) return;

  const mx = input.getX();
  const my = input.getY();

  const bothTeethGone = state.teethStateTop >= 5 && state.teethStateBottom >= 5;
  const eyesFaded =
    state.colorTransitionStart !== null &&
    now() - state.colorTransitionStart >= CONFIG.colorTransitionDuration;

  if (bothTeethGone && eyesFaded && state.ceroFadeStart === null) {
    state.ceroFadeStart = now();
  }

  let brokeSomething = false;

  if (isClickInTeethTop(mx, my) && state.teethStateTop < 5) {
    state.teethStateTop += 1;
    brokeSomething = true;
  }

  if (isClickInTeethBottom(mx, my) && state.teethStateBottom < 5) {
    state.teethStateBottom += 1;
    brokeSomething = true;
  }

  if (brokeSomething) {
    playTeethSound();
  }
}

// -------------------- Drawing --------------------
function drawEye(centerX, centerY) {
  const slideOffset = getSlideInOffset();
  const cx = centerX + slideOffset;
  const cy = centerY;

  const mx = input.getX();
  const my = input.getY();
  const angle = Math.atan2(my - cy, mx - cx);
  const maxDistance = CONFIG.eyeRadius - CONFIG.pupilRadius;
  const pupilX = cx + Math.cos(angle) * maxDistance;
  const pupilY = cy + Math.sin(angle) * maxDistance;

  const blink = getBlinkAmount();
  const eyelidHeight = CONFIG.eyeRadius * 2 * blink;

  let eyeOpacity = 1;
  if (state.colorTransitionStart !== null) {
    const elapsed = now() - state.colorTransitionStart;
    eyeOpacity = 1 - clamp(elapsed / CONFIG.colorTransitionDuration, 0, 1);
  }

  ctx.save();
  ctx.globalAlpha = eyeOpacity;

  // white eye
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(cx, cy, CONFIG.eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // stroke
  ctx.strokeStyle = "black";
  ctx.lineWidth = CONFIG.strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, CONFIG.eyeRadius, 0, Math.PI * 2);
  ctx.stroke();

  // pupil
  if (blink < 0.8) {
    ctx.fillStyle = "#446eb1";
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, CONFIG.pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, CONFIG.pupilRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // eyelid bars
  if (blink > 0) {
    ctx.fillStyle = "black";
    const lidH = eyelidHeight / 2;
    ctx.fillRect(
      cx - CONFIG.eyeRadius,
      cy - CONFIG.eyeRadius,
      CONFIG.eyeRadius * 2,
      lidH
    );
    ctx.fillRect(
      cx - CONFIG.eyeRadius,
      cy + CONFIG.eyeRadius - lidH,
      CONFIG.eyeRadius * 2,
      lidH
    );
  }

  ctx.restore();
}

function drawTextAndTeeth() {
  const slideOffset = getSlideInOffset();

  const bothTeethGone = state.teethStateTop >= 5 && state.teethStateBottom >= 5;
  if (bothTeethGone && state.colorTransitionStart === null) {
    state.colorTransitionStart = now();
  }

  let textColor = "#fdabd4ff";
  let ceroOpacity = 1;

  if (bothTeethGone && state.colorTransitionStart !== null) {
    const elapsed = now() - state.colorTransitionStart;
    const progress = clamp(elapsed / CONFIG.colorTransitionDuration, 0, 1);
    textColor = interpolateColorHex("#fdabd4ff", "#ffffffff", progress);

    if (state.ceroFadeStart !== null) {
      const fadeElapsed = now() - state.ceroFadeStart;
      const fadeProgress = clamp(fadeElapsed / CONFIG.ceroFadeDuration, 0, 1);
      ceroOpacity = 1 - fadeProgress;
    }
  }

  ctx.save();
  ctx.globalAlpha = ceroOpacity;
  ctx.fillStyle = textColor;
  ctx.font = "400 2799px 'TWK'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0", canvas.width / 2 + slideOffset, canvas.height / 2 + 150);
  ctx.restore();

  // draw teeth top
  if (state.teethStateTop > 0 && state.teethStateTop < 5) {
    const img = images.teeth[state.teethStateTop];
    if (img && img.complete) {
      ctx.drawImage(
        img,
        teethXTop() + slideOffset,
        teethYTop(),
        CONFIG.teethWidth,
        CONFIG.teethHeight
      );
    }
  }

  // draw teeth bottom (flipped vertically)
  if (state.teethStateBottom > 0 && state.teethStateBottom < 5) {
    const img = images.teeth[state.teethStateBottom];
    if (img && img.complete) {
      const x = teethXBottom() + slideOffset;
      const y = teethYBottom();

      ctx.save();
      ctx.translate(x + CONFIG.teethWidth / 2, y + CONFIG.teethHeight / 2);
      ctx.scale(1, -1);
      ctx.translate(
        -(x + CONFIG.teethWidth / 2),
        -(y + CONFIG.teethHeight / 2)
      );
      ctx.drawImage(img, x, y, CONFIG.teethWidth, CONFIG.teethHeight);
      ctx.restore();
    }
  }
}

// -------------------- Main update --------------------
function update(dt) {
  handleInput();

  // background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawEye(eye1X, eyeY);
  drawEye(eye2X, eyeY);

  drawTextAndTeeth();
}

// export for debugging (optional)
window.__sceneState = { state, CONFIG, images };
