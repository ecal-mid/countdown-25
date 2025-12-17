import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

// Initialise le moteur graphique et les entrées
const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Variables cheveux
let hairs = [],
  fallingHairs = [],
  hairOffsets = [],
  centerX,
  centerY;

// Positions et état du rasoir
let razorX = -2000,
  razorY = -2000,
  razorVY = 0, //chute
  razorRot = 0,
  razorRotSpeed = 0;
let bladeAngle = Math.PI / 2,
  prevBladeAngle = Math.PI / 2;

// Timing et état de coupe
let time = 0,
  growth = 0,
  cutTime = -1,
  lastMY = 0,
  cutting = false,
  wasDown = false,
  finishCalled = false,
  fadeIn = 0;
const pivot = { x: 313, y: 83 },
  scale = 0.8;

canvas.style.cursor = "none";

const TWO_PI = Math.PI * 2;

// Charge les trois sons
const sounds = {
  razor: new Audio("./assets/rasoir.mp3"),
  open: new Audio("./assets/open.mp3"),
  close: new Audio("./assets/close.mp3"),
};
sounds.razor.volume = 1.0;

// Configuration de la boucle parfaite pour le son du rasoir
const LOOP_START = 0.1; // Début de la boucle (saute le silence initial)
const LOOP_END = 0.4; // Fin de la boucle (avant la fin du son)
let razorPlaying = false;

// Vérifie et boucle le son du rasoir
function updateRazorLoop() {
  if (razorPlaying && sounds.razor.currentTime >= LOOP_END) {
    sounds.razor.currentTime = LOOP_START;
  }
}

// Formes des cheveux (courbes Bézier)
const curves = [
  { cp1x: -90, cp1y: 70, cp2x: -120, cp2y: 140, endx: -60, endy: 200 },
  { cp1x: 100, cp1y: 65, cp2x: 130, cp2y: 130, endx: 75, endy: 190 },
  { cp1x: -80, cp1y: 80, cp2x: 90, cp2y: 120, endx: -50, endy: 210 },
  { cp1x: 120, cp1y: 60, cp2x: -110, cp2y: 135, endx: 65, endy: 180 },
  { cp1x: -110, cp1y: 75, cp2x: 115, cp2y: 125, endx: -40, endy: 195 },
  { cp1x: -130, cp1y: 70, cp2x: -150, cp2y: 130, endx: -90, endy: 205 },
  { cp1x: 125, cp1y: 68, cp2x: -100, cp2y: 140, endx: 85, endy: 215 },
  { cp1x: -85, cp1y: 85, cp2x: 110, cp2y: 115, endx: -35, endy: 185 },
  { cp1x: 95, cp1y: 62, cp2x: -115, cp2y: 128, endx: 50, endy: 200 },
  { cp1x: -115, cp1y: 78, cp2x: 125, cp2y: 138, endx: -70, endy: 190 },
];

// Cheveux qui tombent après coupe
class FallingHair {
  constructor(x, y, v, bx, by) {
    this.x = x;
    this.y = y;
    this.v = v;
    this.bx = bx;
    this.by = by;
    // Aléatoire pour la chute (3 vitesses différentes)
    const t = ~~(Math.random() * 3);
    this.vx = (Math.random() - 0.5) * [80, 150, 120][t];
    this.vy = [200, 150, 180][t] + Math.random() * [100, 100, 80][t];
    this.vs = (Math.random() - 0.5) * [2, 5, 8][t];
    this.rot = 0;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 600 * dt; // Gravité
    this.rot += this.vs * dt;
    return this.y <= canvas.height + 100;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const p = curves[this.v % 10];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      p.cp1x + this.bx * 0.3,
      p.cp1y + this.by * 0.3,
      p.cp2x + this.bx * 0.7,
      p.cp2y + this.by * 0.7,
      p.endx + this.bx,
      p.endy + this.by
    );
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// Cheveux sur le chiffre (avant coupe)
class Hair {
  constructor(x, y, v) {
    this.x = x;
    this.y = y;
    this.v = v;
    this.cut = false;
    // Ressorts pour l'animation élastique
    this.sx = new Spring({ position: 0, frequency: 3, halfLife: 0.1 });
    this.sy = new Spring({ position: 0, frequency: 3, halfLife: 0.15 });
  }

  // Déforme le cheveu selon la proximité du rasoir
  update(dt, pts, ang, prev) {
    if (this.cut) return;

    // Trouve le point du rasoir le plus proche
    let min = Infinity,
      dx = 0,
      dy = 0;
    for (let p of pts) {
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < min) {
        min = d;
        dx = p.x - this.x;
        dy = p.y - this.y;
      }
    }

    // Si le rasoir est proche, déforme le cheveu
    if (min < 120) {
      const i = 1 - min / 120,
        f = i * i;
      this.sx.target = dx * f * 1.2;
      this.sy.target = dy * f * 1.2;
      const m = ang - prev;
      if (Math.abs(m) > 0.001 && min < 40) this.sx.target += m * i * 300;
    } else {
      this.sx.target = this.sy.target = 0;
    }
    this.sx.step(dt);
    this.sy.step(dt);
  }
  cutHair() {
    if (this.cut) return null;
    this.cut = true;
    return new FallingHair(
      this.x,
      this.y,
      this.v,
      this.sx.position,
      this.sy.position
    );
  }
  draw(ctx, g, fade) {
    const o = Math.min(g * 2, 1) * (1 - fade);
    if (this.cut) {
      // Cheveu coupé : juste un point
      if (o > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${o})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, TWO_PI);
        ctx.fill();
      }
    } else {
      // Dessine la courbe du cheveu
      const p = curves[this.v % 10],
        bx = this.sx.position,
        by = this.sy.position;
      if (g > 0.01) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.bezierCurveTo(
          this.x + (p.cp1x + bx * 0.3) * g,
          this.y + (p.cp1y + by * 0.3) * g,
          this.x + (p.cp2x + bx * 0.7) * g,
          this.y + (p.cp2y + by * 0.7) * g,
          this.x + (p.endx + bx) * g,
          this.y + (p.endy + by) * g
        );
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Point à la racine
      if (o > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${o})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, TWO_PI);
        ctx.fill();
      }
    }
  }
}

// Génère les cheveux sur le chiffre 3
// Réinitialiser complètement pour éviter les duplications
hairs = [];
fallingHairs = [];
hairOffsets = [];

centerX = canvas.width / 2;
centerY = canvas.height / 2;

// Canvas temporaire pour tracer le chiffre 3
const tc = document.createElement("canvas");
tc.width = canvas.width;
tc.height = canvas.height;
const tctx = tc.getContext("2d");
tctx.fillStyle = "black";
tctx.fillRect(0, 0, tc.width, tc.height);
tctx.fillStyle = "white";
tctx.font = "bold 1200px Helvetica";
tctx.textAlign = "center";
tctx.textBaseline = "middle";
tctx.fillText("3", centerX, centerY);

// Place les cheveux sur les zones blanches
const img = tctx.getImageData(0, 0, tc.width, tc.height);
for (let i = 0; i < 25000; i++) {
  const x = Math.random() * tc.width,
    y = Math.random() * tc.height;
  if (img.data[(~~y * tc.width + ~~x) * 4] > 128) {
    const v = ~~(Math.random() * 10);
    hairOffsets.push({ x: x - centerX, y: y - centerY, v });
    hairs.push(new Hair(x, y, v));
  }
}

// Fonction pour recalculer les positions
function updateHairPositions() {
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;
  hairs.forEach((h, i) => {
    h.x = centerX + hairOffsets[i].x;
    h.y = centerY + hairOffsets[i].y;
  });
  fallingHairs = [];
}

// Recalcule les positions au redimensionnement
window.addEventListener("resize", updateHairPositions);

// Assure que les positions sont correctes dès le départ
updateHairPositions();

// Rotation d'un point autour du pivot
function rotPt(x, y, a) {
  const c = Math.cos(-a),
    s = Math.sin(-a),
    dx = x - pivot.x,
    dy = y - pivot.y;
  return { x: dx * c - dy * s + pivot.x, y: dx * s + dy * c + pivot.y };
}

// Points de collision de la lame
function getBladePts(x, y, s, a) {
  const pts = [],
    closeFactor = 1 - a / (Math.PI / 2);
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    if (t < 0.67) {
      const comp = -8 + t * 60 * closeFactor;
      const p = rotPt(6 + 307 * t, 40 + 43 * t + comp, a);
      pts.push({ x: x + (p.x - pivot.x) * s, y: y + (p.y - pivot.y) * s });
    }
  }
  return pts;
}

// Points d'interaction autour du rasoir
function getSurfacePts(x, y, s, a) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      p = rotPt(6 + 307 * t, 38 + 45 * t, a);
    pts.push({ x: x + (p.x - pivot.x) * s, y: y + (p.y - pivot.y) * s });
  }
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push({
      x: x + (313 + 20 * (Math.random() - 0.5) - pivot.x) * s,
      y: y + (83 + 380 * t - pivot.y) * s,
    });
  }
  return pts;
}

// Dessine le rasoir avec effet acier
function drawRazor(x, y, s, a, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(r);
  ctx.scale(s, s);
  ctx.translate(-pivot.x, -pivot.y);

  // Lame du rasoir avec dégradé acier intense
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(-a);
  ctx.translate(-pivot.x, -pivot.y);

  // Dégradé acier intense pour la lame
  const bladeGradient = ctx.createLinearGradient(0, 0, 400, 100);
  bladeGradient.addColorStop(0, "#374151"); // Gris foncé
  bladeGradient.addColorStop(0.15, "#9ca3af"); // Gris acier
  bladeGradient.addColorStop(0.25, "#ffffff"); // Reflet blanc vif
  bladeGradient.addColorStop(0.35, "#d1d5db"); // Gris clair
  bladeGradient.addColorStop(0.5, "#6b7280"); // Gris moyen
  bladeGradient.addColorStop(0.65, "#f0f0f0"); // Reflet blanc
  bladeGradient.addColorStop(0.75, "#b0b8c4"); // Gris acier clair
  bladeGradient.addColorStop(0.85, "#ffffff"); // Reflet vif
  bladeGradient.addColorStop(1, "#4b5563"); // Gris foncé

  ctx.fillStyle = bladeGradient;
  ctx.fill(
    new Path2D(
      "M6.48,38.85l186.06,64.73c4.12,1.43,8.69-.09,11.14-3.7l9.86-14.6c1.86-2.76,5-4.36,8.33-4.23,14.77.58,56.59,4.6,85.18,30.96,28.57,26.34,57.95,24.59,68.06,22.99,3.17-.5,5.99-2.53,7.18-5.5,1.51-3.78.38-8.84-13.76-11.3l-10.67-1.86c-8.97-1.56-17.63-4.61-25.59-9.03l-52.42-29.03c-4.91-2.72-10.09-4.94-15.45-6.61L38.47,1.03c-4.57-1.43-9.5-1.39-13.99.28C17.7,3.83,8.61,10.12.98,25.55c-2.55,5.16.06,11.41,5.5,13.3Z"
    )
  );

  // Contour de la lame
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.5;
  ctx.stroke(
    new Path2D(
      "M6.48,38.85l186.06,64.73c4.12,1.43,8.69-.09,11.14-3.7l9.86-14.6c1.86-2.76,5-4.36,8.33-4.23,14.77.58,56.59,4.6,85.18,30.96,28.57,26.34,57.95,24.59,68.06,22.99,3.17-.5,5.99-2.53,7.18-5.5,1.51-3.78.38-8.84-13.76-11.3l-10.67-1.86c-8.97-1.56-17.63-4.61-25.59-9.03l-52.42-29.03c-4.91-2.72-10.09-4.94-15.45-6.61L38.47,1.03c-4.57-1.43-9.5-1.39-13.99.28C17.7,3.83,8.61,10.12.98,25.55c-2.55,5.16.06,11.41,5.5,13.3Z"
    )
  );
  ctx.restore();

  // Manche du rasoir en bois brun
  const handleGradient = ctx.createLinearGradient(280, 80, 380, 80);
  handleGradient.addColorStop(0, "#5c3d2e"); // Brun foncé
  handleGradient.addColorStop(0.15, "#8b5a3c"); // Brun moyen
  handleGradient.addColorStop(0.3, "#a0674b"); // Brun clair (reflet)
  handleGradient.addColorStop(0.45, "#6b4532"); // Brun
  handleGradient.addColorStop(0.6, "#8b5a3c"); // Brun moyen
  handleGradient.addColorStop(0.75, "#a86f4d"); // Reflet bois
  handleGradient.addColorStop(0.9, "#6b4532"); // Brun
  handleGradient.addColorStop(1, "#4a3225"); // Brun très foncé

  ctx.fillStyle = handleGradient;
  ctx.fill(
    new Path2D(
      "M339.08,83.87c-5.84-9.8-21.55-10.87-24.09.26-2.96,12.95-1.08,41.63-1.88,80.42-1.78,85.86-35.78,230.43-46.48,260.72-2.83,8-3.34,16.67-1.34,24.91,12.09,49.87,63.37,42.32,68.56,19.52,25.36-111.44,26.35-287.51,26.35-287.51,0,0,1.82-59.85-21.1-98.32Z"
    )
  );

  // Contour du manche
  ctx.strokeStyle = "#3d261a";
  ctx.lineWidth = 1.5;
  ctx.stroke(
    new Path2D(
      "M339.08,83.87c-5.84-9.8-21.55-10.87-24.09.26-2.96,12.95-1.08,41.63-1.88,80.42-1.78,85.86-35.78,230.43-46.48,260.72-2.83,8-3.34,16.67-1.34,24.91,12.09,49.87,63.37,42.32,68.56,19.52,25.36-111.44,26.35-287.51,26.35-287.51,0,0,1.82-59.85-21.1-98.32Z"
    )
  );

  ctx.restore();
}

// Boucle principale
function update(dt) {
  time += dt;
  const mx = input.getX(),
    my = input.getY(),
    down = input.isPressed(),
    onCanvas = mx > 0 || my > 0;
  const moving = my > lastMY;
  lastMY = my;

  // Transition du noir au beige au début
  if (fadeIn < 1) fadeIn = Math.min(fadeIn + dt * 0.5, 1);

  // Les cheveux poussent progressivement
  if (growth < 1 && time > 0.5) growth = Math.min((time - 0.5) / 2, 1);

  // Vérifie si tous les cheveux sont coupés
  const allCut = hairs.every((h) => h.cut);
  if (allCut && cutTime === -1) cutTime = time;

  // Animations après la fin
  let fadeOut = 0,
    fall = false;
  if (cutTime !== -1) {
    const t = time - cutTime;
    if (t > 0.5) fall = true;
    if (t > 1.5) fadeOut = Math.min((t - 1.5) / 1, 1);
    // Appeler finish() quand l'écran est complètement noir
    if (fadeOut >= 1 && !finishCalled) {
      finishCalled = true;
      finish();
    }
  }

  // Gère le mouvement du rasoir
  if (fall) {
    razorVY += 1200 * dt;
    razorY += razorVY * dt;
    razorRotSpeed += 1.5 * dt;
    razorRot += razorRotSpeed * dt;
  } else if (onCanvas) {
    razorX += (mx - razorX) * 0.2;
    razorY += (my - razorY) * 0.2;
  } else {
    razorX = mx;
    razorY = my;
  }

  // Sons d'ouverture/fermeture
  if (down && !wasDown) {
    sounds.close.currentTime = 0;
    sounds.close.play();
  }
  if (!down && wasDown) {
    sounds.open.currentTime = 0;
    sounds.open.play();
  }
  wasDown = down;

  // Anime l'angle des lames
  prevBladeAngle = bladeAngle;
  bladeAngle += ((down ? 0 : Math.PI / 2) - bladeAngle) * 0.15;

  // Fond noir puis peau beige (transition du noir au beige)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dessiner le fond beige avec fadeIn
  if (fadeIn > 0) {
    ctx.fillStyle = `rgba(248, 192, 165, ${fadeIn})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Détecte les collisions
  const surf = getSurfacePts(razorX, razorY, scale, bladeAngle);
  let cutCount = 0; // Nombre de poils coupés cette frame
  const now = performance.now();

  if (down && bladeAngle < 0.1 && growth >= 1 && !fall && moving) {
    const bp = getBladePts(razorX, razorY, scale, bladeAngle);
    for (let h of hairs) {
      if (h.cut) continue;
      for (let i = 0; i < bp.length; i += 2) {
        const dx = bp[i].x - h.x,
          dy = bp[i].y - h.y;
        if (dx * dx + dy * dy < 225 && Math.random() < 0.85) {
          const f = h.cutHair();
          if (f) {
            fallingHairs.push(f);
            cutCount++;
          }
          break;
        }
      }
    }
  }

  // Gestion du son du rasoir - boucle parfaite au milieu du son
  if (cutCount > 0) {
    // Démarre le son si pas déjà en cours
    if (!razorPlaying) {
      sounds.razor.currentTime = LOOP_START; // Commence directement au son
      sounds.razor.play();
      razorPlaying = true;
    }
    // Maintient la boucle
    updateRazorLoop();
    cutting = true;
  } else if (cutting) {
    // Arrête immédiatement quand on ne coupe plus
    sounds.razor.pause();
    razorPlaying = false;
    cutting = false;
  }

  // Met à jour et dessine
  hairs.forEach((h) => h.update(dt, surf, bladeAngle, prevBladeAngle));
  for (let i = fallingHairs.length - 1; i >= 0; i--) {
    if (!fallingHairs[i].update(dt)) fallingHairs.splice(i, 1);
    else fallingHairs[i].draw(ctx);
  }

  hairs.forEach((h) => h.draw(ctx, growth, fadeOut));
  if (onCanvas && razorY > -200 && razorY < canvas.height + 300)
    drawRazor(razorX, razorY, scale, bladeAngle, razorRot);

  // Overlay noir pour le fadeOut final (transition du beige au noir)
  if (fadeOut > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeOut})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

run(update);
