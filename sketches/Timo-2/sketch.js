import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Charger les images
const arrowImage = new Image();
arrowImage.src = "./arrow.png";

const stopSignImage = new Image();
stopSignImage.src = "./stop_sign.png";

// Charger le son de rebond
const bounceSound = new Audio("./click.mp3");
bounceSound.preload = "auto";
bounceSound.volume = 0.6;

// Taille de l'image pour les points
let imageSize = 700;
let mini = 0.3; // Facteur de scale (0 = invisible, 1 = taille normale)

run(update);

let sketchStarted = false;
function update() {
  if (!sketchStarted) {
    sketchStarted = true;
    animate();
  }
}

window.addEventListener("keypress", (e) => {
  if (e.key === "f" || e.key === "F") {
    finish();
  }
});

const fixedPoints = [
  { x: 660, y: 860, radius: 5, magnetPower: 1000 },
  { x: 660, y: 540, radius: 5, magnetPower: 1000 },
  { x: 1520, y: 260, radius: 5, magnetPower: 1000 },
  { x: 2260, y: 260, radius: 5, magnetPower: 1000 },
  { x: 2550, y: 540, radius: 5, magnetPower: 1000 },
  { x: 2550, y: 980, radius: 5, magnetPower: 1000 },
  { x: 2020, y: 1520, radius: 5, magnetPower: 1000 },
  { x: 2550, y: 1520, radius: 5, magnetPower: 1000 },
  { x: 2550, y: 1940, radius: 5, magnetPower: 1000 },
  { x: 660, y: 1940, radius: 5, magnetPower: 1000 },
  { x: 2140, y: 800, radius: 5, magnetPower: 1000 },
  { x: 2140, y: 700, radius: 5, magnetPower: 1000 },
  { x: 2050, y: 620, radius: 5, magnetPower: 1000 },
  { x: 1780, y: 620, radius: 5, magnetPower: 1000 },
  { x: 1700, y: 700, radius: 5, magnetPower: 1000 },
  { x: 1700, y: 880, radius: 5, magnetPower: 1000 },
];

// Fonction pour créer les points répartis sur toute la largeur
function createDraggablePoints() {
  const points = [];
  const numPoints = 16;
  const margin = 100; // Marge de chaque côté
  const startX = margin;
  const endX = canvas.width - margin;
  const spacing = (endX - startX) / (numPoints - 1);
  const yPosition = canvas.height / 2;

  for (let i = 0; i < numPoints; i++) {
    const xPosition = startX + i * spacing;
    points.push({
      x: xPosition,
      y: yPosition,
      initialX: xPosition,
      initialY: yPosition,
      vx: 0,
      vy: 0,
      radius: 5,
      isDragging: false,
      isAnimating: false,
      isMagnetized: false,
      fixedPointIndex: i,
      introScale: 0,
      introDelay: i * 0.05,
      introStarted: false,
      outroScale: 1,
    });
  }

  return points;
}

const draggablePoints = createDraggablePoints();

let startTime = null;
let allMagnetized = false;
let outroStartTime = null;
let shapeOpacity = 1;

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Fonction d'easing simple (ease out)
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dessiner la forme créée par les points déplaçables
  if (draggablePoints.length > 0 && shapeOpacity > 0) {
    ctx.beginPath();
    ctx.moveTo(draggablePoints[0].x, draggablePoints[0].y);

    for (let i = 1; i < draggablePoints.length; i++) {
      ctx.lineTo(draggablePoints[i].x, draggablePoints[i].y);
    }

    ctx.closePath();
    ctx.fillStyle = `rgba(0, 0, 0, ${shapeOpacity})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${shapeOpacity})`;
    ctx.lineWidth = 20;
    ctx.stroke();
  }

  // Dessiner les points fixes (transparents)
  fixedPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0)"; // Transparent
    ctx.fill();
  });

  // Dessiner les points déplaçables avec rotation vers leur point fixe
  draggablePoints.forEach((point) => {
    if (point.introScale > 0 && point.outroScale > 0) {
      // Calculer l'angle et la distance vers le point fixe associé
      const associatedFixed = fixedPoints[point.fixedPointIndex];
      const dx = associatedFixed.x - point.x;
      const dy = associatedFixed.y - point.y;
      const distanceToFixed = Math.sqrt(dx * dx + dy * dy);

      // Choisir l'image selon la distance
      const imageToUse = distanceToFixed < 100 ? stopSignImage : arrowImage;

      if (imageToUse.complete) {
        const scaledSize =
          imageSize * mini * point.introScale * point.outroScale;
        ctx.save();
        ctx.translate(point.x, point.y);

        // Appliquer la rotation seulement pour l'image arrow
        if (imageToUse === arrowImage) {
          // Calculer l'angle en radians et ajouter 180 degrés (Math.PI)
          const angle = Math.atan2(dy, dx) + Math.PI;
          ctx.rotate(angle);
        }

        ctx.drawImage(
          imageToUse,
          -scaledSize / 2,
          -scaledSize / 2,
          scaledSize,
          scaledSize
        );
        ctx.restore();
      }
    }
  });
}

function animate() {
  if (!startTime) startTime = Date.now();
  const elapsed = (Date.now() - startTime) / 1000;

  // Animer l'apparition des points
  draggablePoints.forEach((point) => {
    const timeSinceDelay = elapsed - point.introDelay;

    if (timeSinceDelay > 0 && point.introScale < 1) {
      const duration = 0.6; // Durée de l'animation en secondes
      const progress = Math.min(timeSinceDelay / duration, 1);
      point.introScale = easeOutCubic(progress);

      // Fixer à exactement 1 quand l'animation est terminée
      if (progress >= 1) {
        point.introScale = 1;
      }
    }

    if (point.isAnimating) {
      // Récupérer le point fixe associé à ce point déplaçable
      const associatedFixed = fixedPoints[point.fixedPointIndex];

      let targetX, targetY;

      // Calculer la distance avec le point fixe associé
      const dist = getDistance(
        point.x,
        point.y,
        associatedFixed.x,
        associatedFixed.y
      );
      const currentMagnetDistance = associatedFixed.magnetPower;

      if (dist < currentMagnetDistance && !point.isMagnetized) {
        point.isMagnetized = true;
        targetX = associatedFixed.x;
        targetY = associatedFixed.y;
      } else if (point.isMagnetized) {
        targetX = associatedFixed.x;
        targetY = associatedFixed.y;
      } else {
        targetX = point.initialX;
        targetY = point.initialY;
      }

      const dx = targetX - point.x;
      const dy = targetY - point.y;

      point.vx += dx * 0.01;
      point.vy += dy * 0.01;

      point.vx *= 0.9;
      point.vy *= 0.9;

      point.x += point.vx;
      point.y += point.vy;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        point.x = targetX;
        point.y = targetY;
        point.vx = 0;
        point.vy = 0;
        point.isAnimating = false;
      }
    }
  });

  // Vérifier si tous les points sont magnétisés
  const allPointsMagnetized = draggablePoints.every(
    (point) => point.isMagnetized
  );

  if (allPointsMagnetized && !allMagnetized) {
    allMagnetized = true;
    outroStartTime = Date.now();
  }

  // Animation de sortie si tous les points sont magnétisés
  if (allMagnetized && outroStartTime) {
    const outroElapsed = (Date.now() - outroStartTime) / 1000;
    const delayBeforeOutro = 4; // Délai de 4 secondes
    const outroDuration = 0.8;

    if (outroElapsed > delayBeforeOutro) {
      const animationTime = outroElapsed - delayBeforeOutro;

      if (animationTime < outroDuration) {
        const progress = animationTime / outroDuration;
        const easeProgress = easeOutCubic(progress);

        // Réduire le scale des images
        draggablePoints.forEach((point) => {
          point.outroScale = 1 - easeProgress;
        });

        // Réduire l'opacité de la forme
        shapeOpacity = 1 - easeProgress;
      } else {
        // Animation terminée
        draggablePoints.forEach((point) => {
          point.outroScale = 0;
        });
        shapeOpacity = 0;
        finish(); // Appeler finish() après l'animation
      }
    }
  }

  draw();
  requestAnimationFrame(animate);
}

function isMouseOverPoint(mouseX, mouseY, point) {
  const dx = mouseX - point.x;
  const dy = mouseY - point.y;
  return Math.sqrt(dx * dx + dy * dy) <= imageSize / 6;
}

canvas.addEventListener("mousedown", (e) => {
  const mouseX = e.clientX * 2;
  const mouseY = e.clientY * 2;

  for (let i = draggablePoints.length - 1; i >= 0; i--) {
    const point = draggablePoints[i];
    if (isMouseOverPoint(mouseX, mouseY, point)) {
      console.log(mouseX, mouseY, point);
      point.isDragging = true;
      point.isAnimating = false;
      point.isMagnetized = false;
      break;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  draggablePoints.forEach((point) => {
    if (point.isDragging) {
      point.x = e.clientX * 2;
      point.y = e.clientY * 2;
      draw();
    }
  });
});

canvas.addEventListener("mouseup", () => {
  draggablePoints.forEach((point) => {
    if (point.isDragging) {
      point.isDragging = false;
      point.isAnimating = true;

      // Jouer le son de rebond au relâchement
      try {
        // remettre à zéro pour autoriser les lectures rapprochées
        bounceSound.currentTime = 0;
        bounceSound.play();
      } catch (e) {
        // ignorer les erreurs de lecture (autoplay policy, fichier manquant...)
      }
    }
  });
});

function moveAllPointsToTargets() {
  draggablePoints.forEach((point) => {
    point.isDragging = false;
    point.isMagnetized = true;
    point.isAnimating = true;
    point.vx = 0;
    point.vy = 0;
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "a") {
    moveAllPointsToTargets();
  }
});

arrowImage.onload = () => {
  // draw();
};
