import { createEngine } from "../_shared/engine.js";

// ⚠️ ici on récupère aussi `audio`
const { renderer, input, math, run, finish, audio } = createEngine();
const { ctx, canvas } = renderer;

// ---------- SONS ----------
const brickPop = await audio.load("assets-typo/brick-soundv2.mp3"); // adapte le chemin

const brickW = 300 * window.devicePixelRatio,
  brickH = 104 * window.devicePixelRatio;
const bricks = [];
let buildIndex = 0;
const buildSpeed = 50;
let numberOpacity = 1;

const viewportWidth = canvas.width;
const viewportHeight = canvas.height;
const maxVisibleHeight = viewportHeight;

// ✅ nouveau : l’intro est finie quand toutes les briques ont été affichées
let introFinished = false;

// ---------------- CREATE BRICKS ----------------
for (let r = 0; r < Math.ceil(viewportHeight / brickH); r++) {
  const offset = r % 2 === 0 ? 0 : -brickW / 2;
  for (
    let c = r % 2 === 0 ? 0 : -1;
    c <= Math.ceil(viewportWidth / brickW);
    c++
  ) {
    const x = c * brickW + offset;

    if (x + brickW > 0 && x < viewportWidth) {
      bricks.push({
        x: x,
        y: r * brickH,
        w: brickW,
        h: brickH,
        visible: false,
        vy: 0,
      });
    }
  }
}

// reveal bricks one by one
//here i just delayed the start of the interval by 1 second
setTimeout(function () {
  setInterval(() => {
    if (buildIndex < bricks.length) {
      bricks[buildIndex].visible = true;
      buildIndex++;

      // ✅ quand on a tout affiché → fin de l’intro
      if (buildIndex >= bricks.length) {
        introFinished = true;
      }
    }
  }, buildSpeed);
}, 1000);

// ---------- PHYSICS ----------
function isSupported(brick) {
  if (brick.y + brick.h >= maxVisibleHeight) return true;

  for (let b of bricks) {
    if (
      b.visible &&
      b !== brick &&
      b.y + b.h >= brick.y + brick.h - 1 &&
      b.y + b.h <= brick.y + brick.h + 1 &&
      brick.x < b.x + b.w &&
      brick.x + brick.w > b.x
    )
      return true;
  }
  return false;
}

function physics() {
  // pas de physique pendant l’intro
  if (buildIndex < bricks.length) return;

  for (let brick of bricks) {
    if (!brick.visible) continue;

    if (!isSupported(brick)) brick.vy += 1;
    else brick.vy = 0;

    brick.y += brick.vy;

    for (let b of bricks) {
      if (
        b.visible &&
        b !== brick &&
        brick.y + brick.h > b.y &&
        brick.y < b.y + b.h &&
        brick.x < b.x + b.w &&
        brick.x + brick.w > b.x
      ) {
        brick.y = b.y - brick.h;
        brick.vy = 0;
      }
    }
  }
}

// ---------- DRAW ----------
function draw() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const visibleBricks = bricks.filter((b) => b.visible);

  // quand toutes les briques ont disparu → on commence à fade le 3
  if (buildIndex >= bricks.length && visibleBricks.length === 0) {
    numberOpacity = Math.max(0, numberOpacity - 0.02);
  }

  // ✅ on ne dessine le 3 que quand l’intro est terminée
  if (introFinished && numberOpacity > 0) {
    ctx.globalAlpha = numberOpacity;
    ctx.fillStyle = "white";
    ctx.font = "400 2799px 'TWK'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3", w / 2, h / 2 + 150);
    ctx.globalAlpha = 1;
  }

  // draw bricks
  bricks
    .filter((b) => b.visible)
    .sort((a, b) => a.y - b.y)
    .forEach((brick) => {
      ctx.fillStyle = "#932730";
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
    });
}

// ---------- ENGINE UPDATE ----------
function update(dt) {
  physics();
  draw();

  // when the number has faded, end the scene
  if (buildIndex >= bricks.length && numberOpacity <= 0) {
    finish();
  }
}

// press f to finish
window.addEventListener("keypress", (e) => {
  if (e.key === "f") {
    finish();
  }
});

run(update);

// ---------- MOUSE INTERACTION ----------
canvas.addEventListener("mousemove", (e) => {
  // pas d’interaction tant que l’intro n’est pas finie
  if (buildIndex < bricks.length) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  for (let brick of bricks) {
    if (
      brick.visible &&
      x >= brick.x &&
      x <= brick.x + brick.w &&
      y >= brick.y &&
      y <= brick.y + brick.h
    ) {
      brick.visible = false;

      // 🔊 jouer le son quand une brique disparaît
      brickPop.play({ rate: 1, volume: 1 });

      break;
    }
  }
});
