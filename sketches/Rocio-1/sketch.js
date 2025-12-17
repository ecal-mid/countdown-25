import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// ---------------------------------------------------------
// 1. CONFIG GLOBALE
// ---------------------------------------------------------

// Layout
const topY = 300;
const bottomY = 1200;
const zipperHandleWidth = 80;
const zipperHandleHeight = 220;

const topImageWidth = 250;
const topImageHeight = 1100;

// Transitions
const SLIDE_IN_DURATION = 1.5; // s
const NUMBER_ZOOM_DURATION = 0.4; // s
const ONE_FADE_DURATION = 1; // s

// Taille du "1"
const INITIAL_FONT_SIZE = 990;
const FINAL_FONT_SIZE = 2799;

// Couleurs
const JEAN_BLUE = "#446eb1";

// ---------------------------------------------------------
// 2. ÉTAT GLOBAL
// ---------------------------------------------------------

// Canvas centre
let centerX = 0;
let centerY = 0;

// Position commune de tous les "1"
let oneCenterX = 0;
let oneCenterY = 0;

// Zipper & top image (jean + poches)
let zipperPosY = topY;
let zipperRange = 0;
let openDistance = 0;

let isDragging = false;
let dragOffsetY = 0;

let isTopSvgDragging = false;
let topSvgOffsetX = 0;
let topSvgDragOffsetX = 0;

// Transition zoom du "1" + fade du bleu
let currentState = "intro";
let currentStateTime = 0;

// Assets
let svg; // slider
let topSvg; // jean + poches
let openSvg; // non utilisé ici mais chargé
let zipperSound;

// ---------------------------------------------------------
// 3. INITIALISATION
// ---------------------------------------------------------

async function preload() {
  svg = await loadSvg("./assets-02/slider.svg");
  topSvg = await loadSvg("./assets-02/zipper-fly.svg");
  run(update); // on lance la boucle dès que les assets principaux sont prêts
  openSvg = await loadSvg("./assets-02/zipper-fly-open-.svg");

  zipperSound = new Audio("./assets-02/zipper-sound.mp3");
  zipperSound.loop = true;
}

preload();

// raccourci clavier pour finir
window.addEventListener("keypress", (e) => {
  if (e.key === "f") {
    finish();
  }
});

// ---------------------------------------------------------
// 4. UTILS
// ---------------------------------------------------------

function playZipperSound() {
  if (!zipperSound) return;
  if (zipperSound.paused) {
    zipperSound.currentTime = 0;
    zipperSound.play().catch(() => {});
  }
}

function stopZipperSound() {
  if (!zipperSound) return;
  zipperSound.pause();
  zipperSound.currentTime = 0;
}

async function loadSvg(path) {
  return new Promise((resolve) => {
    const svg = document.createElement("img");
    svg.src = path;
    svg.addEventListener("load", () => {
      resolve(svg);
      console.log("loaded " + path);
    });
  });
}

// ---------------------------------------------------------
// 6. INTERACTION / INPUT
// ---------------------------------------------------------

function computeNumberOneHitbox() {
  ctx.save();
  ctx.font = INITIAL_FONT_SIZE + "px TWK";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText("1");
  const oneWidth = metrics.width;
  const oneHeight = INITIAL_FONT_SIZE; // approx

  const oneX = oneCenterX - oneWidth / 2;
  const oneY = oneCenterY - oneHeight / 2;

  ctx.restore();

  const isOver =
    input.getX() >= oneX &&
    input.getX() <= oneX + oneWidth &&
    input.getY() >= oneY &&
    input.getY() <= oneY + oneHeight;

  return isOver;
}

function handlePressLogic(isOverSliderHandle, isOverTopSvg, isOverNumberOne) {
  if (!input.isPressed()) {
    // fin du drag
    if (isDragging) stopZipperSound();
    isDragging = false;
    isTopSvgDragging = false;
    return;
  }

  // drag du jean (topSvg)
  if (isOverTopSvg && !isDragging && !isTopSvgDragging) {
    isTopSvgDragging = true;
    topSvgDragOffsetX = input.getX() - (centerX + topSvgOffsetX);
  }

  // drag du slider
  if (isOverSliderHandle && !isDragging && !isTopSvgDragging) {
    isDragging = true;
    dragOffsetY = input.getY() - zipperPosY;
    playZipperSound();
  }
}

function updateDragging() {
  if (isDragging) {
    zipperPosY = input.getY() - dragOffsetY;
  }

  if (isTopSvgDragging) {
    topSvgOffsetX = input.getX() - topSvgDragOffsetX - centerX;
    topSvgOffsetX = math.clamp(topSvgOffsetX, 0, 230);
  }

  zipperPosY = math.clamp(zipperPosY, topY, bottomY);
  zipperRange = bottomY - topY;
  openDistance = zipperPosY - topY;
}

// ---------------------------------------------------------
// 7. RENDU / SCÈNE
// ---------------------------------------------------------

// Dessine toute la scène
function drawScene() {
  // -------------------------------------------------------
  // ÉTAT FINAL : écran noir + "1" qui fade out
  // -------------------------------------------------------
  if (currentState === "endFadeout") {
    // Fond noir plein
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fill();

    // Opacité du "1"
    const oneOpacity = Math.max(0, 1 - currentStateTime / ONE_FADE_DURATION);

    ctx.save();
    ctx.globalAlpha = oneOpacity;
    ctx.font = FINAL_FONT_SIZE + "px TWK";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", centerX, centerY + 150);
    ctx.restore();

    // IMPORTANT : on ne redessine pas la scène bleue
    return;
  }

  // -------------------------------------------------------
  // ÉTATS INTRO / ZIPPER / NUMBER_SCALE : scène bleue
  // -------------------------------------------------------
  ctx.save();
  {
    // Fond noir de base
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fill();

    // slide in
    let slideOffsetX = 0;

    if (currentState === "intro") {
      const progress = math.clamp(currentStateTime / SLIDE_IN_DURATION, 0, 1);
      slideOffsetX = math.lerp(-canvas.width - 400, 0, progress);
    }
    ctx.translate(slideOffsetX, 0);

    // Fond bleu (jean)
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = JEAN_BLUE;
    ctx.fill();

    // --------------------
    // CLIP (courbe + "1" à l'intérieur)
    // --------------------

    ctx.save();
    {
      ctx.beginPath();
      drawCurve();
      ctx.clip();

      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.fill();

      if (currentState === "zipper") {
        ctx.font = INITIAL_FONT_SIZE + "px TWK";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // "1" masqué → même centre que les autres
        ctx.fillText("1", oneCenterX, oneCenterY);
      }
    }
    ctx.restore();

    // Bord noir de la courbe
    ctx.beginPath();
    drawCurve();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.stroke();

    // ligne horizontale en haut
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(canvas.width, topY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Zipper (goutte blanche + ligne)
    const ellipseWidth = 80;
    const ellipseHeight = 80;
    const offsetX = math.mapClamped(openDistance, 0, 100, 0, 100);

    // ligne verticale qui se déplace avec l'ouverture
    ctx.beginPath();
    ctx.moveTo(centerX - 113 + offsetX, 0);
    ctx.lineTo(centerX - 113 + offsetX, topY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.stroke();

    // panneaux bleus latéraux (gauche/droite)
    ctx.beginPath();
    ctx.rect(centerX - 1050, topY - 300, 100, 330);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.fillStyle = JEAN_BLUE;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(centerX + 950, topY - 300, 100, 330);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.fillStyle = JEAN_BLUE;
    ctx.fill();
    ctx.stroke();

    // ellipse blanche (haut du zip)
    ctx.beginPath();
    ctx.ellipse(
      centerX + offsetX,
      topY / 2,
      ellipseWidth,
      ellipseHeight,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.stroke();

    // slider (fermeture éclair) limité à la zone sous la ligne horizontale
    ctx.save();
    {
      ctx.beginPath();
      ctx.rect(
        centerX - zipperHandleWidth / 2,
        topY,
        zipperHandleWidth,
        canvas.height - topY
      );
      ctx.clip();

      ctx.drawImage(
        svg,
        centerX - zipperHandleWidth / 2,
        zipperPosY - zipperHandleHeight / 2,
        zipperHandleWidth,
        zipperHandleHeight
      );
    }
    ctx.restore();

    // top image : jean + poches (tout sur la même image → disparaît ensemble avec alpha)
    ctx.drawImage(
      topSvg,
      centerX + topSvgOffsetX - topImageWidth / 2,
      topY - topImageHeight / 2 + 537.5,
      topImageWidth,
      topImageHeight
    );
  }
  ctx.restore();

  // -------------------------------------------------------
  // Overlay noir progressif pendant le zoom (numberScale)
  // -------------------------------------------------------
  ctx.save();
  {
    let alpha = 1;
    if (currentState === "numberScale") {
      alpha = math.mapClamped(currentStateTime, 0, NUMBER_ZOOM_DURATION, 1, 0);
    }
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, " + (1 - alpha) + ")";
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------
  // "1" qui zoome et se recentre
  // -------------------------------------------------------
  if (currentState == "numberScale") {
    let t = currentStateTime / NUMBER_ZOOM_DURATION;
    t = math.clamp(t, 0, 1);
    const fontSize = math.lerp(INITIAL_FONT_SIZE, FINAL_FONT_SIZE, t);

    // interpolation de la position vers le centre (un peu plus bas)
    const animatedX = math.lerp(oneCenterX, centerX, t);
    const animatedY = math.lerp(oneCenterY, centerY + 150, t);

    ctx.save();
    ctx.font = fontSize + "px TWK";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", animatedX, animatedY);
    ctx.restore();
  }
}

function drawCurve() {
  const controlX = math.mapClamped(openDistance, 0, zipperRange, 0, 300);
  ctx.moveTo(centerX, topY);
  ctx.bezierCurveTo(
    centerX - controlX,
    math.lerp(topY, zipperPosY, 0.25),
    centerX - controlX,
    math.lerp(topY, zipperPosY, 0.75),
    centerX,
    zipperPosY
  );
  ctx.lineTo(centerX, bottomY);
  ctx.lineTo(centerX, zipperPosY);
  ctx.bezierCurveTo(
    centerX + controlX,
    math.lerp(topY, zipperPosY, 0.75),
    centerX + controlX,
    math.lerp(topY, zipperPosY, 0.25),
    centerX,
    topY
  );
}

// ---------------------------------------------------------
// 8. BOUCLE PRINCIPALE
// ---------------------------------------------------------

function update(dt) {
  // Mise à jour des centres
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;

  // Position commune du "1" (avant anim)
  oneCenterX = centerX - 20;
  oneCenterY = centerY - 210;

  let newState = null;
  switch (currentState) {
    case "intro": {
      if (currentStateTime >= SLIDE_IN_DURATION) {
        newState = "zipper";
      }
      break;
    }
    case "zipper": {
      // ---- état normal : jean + poches + zip actifs ----

      // Zones interactives
      const isOverSliderHandle =
        input.getX() >= centerX - zipperHandleWidth / 2 &&
        input.getX() <= centerX + zipperHandleWidth / 2 &&
        input.getY() >= zipperPosY - zipperHandleHeight / 2 &&
        input.getY() <= zipperPosY + zipperHandleHeight / 2;

      const isOverTopSvg =
        input.getX() >= centerX + topSvgOffsetX - topImageWidth / 2 &&
        input.getX() <= centerX + topSvgOffsetX + topImageWidth / 2 &&
        input.getY() >= topY - topImageHeight / 2 + 537 &&
        input.getY() <= topY - topImageHeight / 2 + 537 + topImageHeight;

      const isOverNumberOne = computeNumberOneHitbox();

      // Gestion des clics / drags
      handlePressLogic(isOverSliderHandle, isOverTopSvg, isOverNumberOne);
      updateDragging();

      // Clic sur le "1" quand la fermeture éclair est tout en bas
      if (
        input.isPressed() &&
        zipperPosY === bottomY &&
        isOverNumberOne &&
        !isDragging &&
        !isTopSvgDragging
      ) {
        newState = "pendingNumberTransition";
      }
      break;
    }
    case "pendingNumberTransition": {
      // clic pour lancer le zoom
      if (input.isPressed()) {
        newState = "numberScale";
      }
      break;
    }
    case "numberScale": {
      // quand le zoom est fini et qu'on reclique → fade out final
      if (input.isPressed() && currentStateTime >= NUMBER_ZOOM_DURATION) {
        newState = "endFadeout";
      }
      break;
    }
    case "endFadeout": {
      // quand le "1" est totalement invisible → fin
      if (currentStateTime >= ONE_FADE_DURATION) {
        finish();
      }
      break;
    }
  }

  currentStateTime += dt;

  if (newState !== null) {
    currentState = newState;
    currentStateTime = 0;
    console.log("enter state: " + currentState);

    // enter new state
    switch (currentState) {
      case "pendingNumberTransition": {
        stopZipperSound();
        break;
      }
      case "numberScale": {
        break;
      }
      case "endFadeout": {
        // rien de spécial, on gère tout dans drawScene
        break;
      }
    }
  }

  // Scène complète
  drawScene();
}
