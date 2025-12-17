import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;

let pimples = [];
let pimpleOffsets = [];
let centerX, centerY;
let fingerGapSpring = new Spring({
  position: 100,
  frequency: 3,
  halfLife: 0.1,
});
// Springs pour suivre la position du curseur avec les mains (plus réactifs)
let handXSpring = new Spring({
  position: 0,
  frequency: 12,
  halfLife: 0.02,
});
let handYSpring = new Spring({
  position: 0,
  frequency: 12,
  halfLife: 0.02,
});
let handsInitialized = false; // Pour initialiser les springs à la première frame
let wasDown = false;
let time = 0;
let fadeIn = 0;
let allPoppedTime = -1;
let handsIntroProgress = 0; // 0 à 1 pour l'arrivée des mains
let handsOutroProgress = 0; // 0 à 1 pour le départ des mains
let finishCalled = false;

const buttonImg = new Image();
buttonImg.src = "./assets/bouton.png";

// Charger les sons
const pressSound = new Audio("./assets/press.mp3");
const explodeSound = new Audio("./assets/explose.mp3");
pressSound.volume = 0.9;
explodeSound.volume = 1.0;

canvas.style.cursor = "none";

const TWO_PI = Math.PI * 2;

const rightHandSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3601.22 472.78"><path d="M2,112.32l2616.99,20.58,163.88,3.49,54.16,2.42c.11,0,.22,0,.34-.01,2.33-.25,27.73-3.32,37.91-17.2s21.05-20.45,22.42-21.26c.09-.06.18-.1.28-.14l89.27-36.98s32.59-12.93,52.75-25.62c17.65-11.11,69.99-13.73,73.22-13.89.11,0,.21-.02.32-.04l63.98-12.62c.37-.07.72-.25,1.01-.5,4.75-3.99,9.67-3.52,11.71-3.09.65.14,1.31-.04,1.84-.45,11.25-8.69,25.23-3.74,28.58-2.35.5.21,1.05.22,1.56.06,4.93-1.58,6.43-.41,6.43-.41,26.06,14.85,51.3,8.62,53.06,8.16.07-.02.13-.04.2-.06,42.83-16.04,54.74-3.85,56.99-.67.29.41.43.91.4,1.41-2.14,34.4-33.95,52.45-33.95,52.45l-25.87,13.29c-1.94,1-1.43,3.9.73,4.18l142.8,18.26s153.39,12.2,172.56,52.29c18.59,38.86-39.81,44.97-43.4,45.3-.11.01-.22.01-.34,0l-130.56-7.83-105.49-7.49c-2.87-.2-3.3,4.07-.44,4.42,19.99,2.47,39.63,2.22,41.33,2.2.08,0,.16,0,.24-.02,61.98-8.22,74.51,22.77,75.62,25.91.06.16.09.33.11.5,6.01,57.29-16.59,65.02-16.59,65.02,0,0-9.59,8.81-51.42,2.71-31.32-4.57-69-2.3-85.95-.87-2.46.21-2.81,3.69-.43,4.35,7.37,2.06,14.98,2.56,15.73,2.61.04,0,.08,0,.12,0,93.49.02,106.35,33.42,107.1,35.62.03.08.04.15.06.23.37,1.75,4.64,23.81-8.74,53.54-13.94,30.99-139.44,0-139.44,0,0,0,75.82,16.07,77.56,40.48,1.6,22.38-9.99,35.96-11.93,38.06-.17.19-.37.34-.6.46-30.39,16.35-59.85,11.15-70.27,11.15s-131.25-5.91-135-6.1c-.06,0-.11,0-.17-.02-2-.27-39.44-5.22-81.84-5.22s-180.37-51.93-187.92-54.78c-.22-.08-.44-.13-.67-.14-59.95-2.68-101.65-22.65-119.92-23.52-18.3-.87-202.88,0-202.88,0L2.01,378.65V112.32Z" style="fill:#f8c0a5; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2737.42,372.57s-7.7-23.93,1.1-47.59" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2791.34,389.62s31.09-16.51,23.66-68.22" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2933.56,269.41s168.59,26.14,228.77,55.56" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2935.86,229.91s86.55-11.94,122.98-9.19c36.42,2.76,83.74-8.27,83.74-8.27,0,0,24.68-5.79,88.54-1.69" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3061.58,160.32s123.47-66.94,173.61-42.73" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2991.71,77.07s31.03-27.64,72.71-37.15" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3178.11,10.94s-1.05,4.03,4.3,8.67" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3191.23,7.72s2.42,3.77,5.73,6.18" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3203.55,2.26s1.61,6.37,13.12,18.77,9.9,15.97,9.9,15.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3237.91,8.76s5.62,7.81,7.49,23.87" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3328.47,5.47v5.34c0,11.94-2.83,12.91-2.83,12.91,0,0-16.96,7.44-31.25,5.51s-12.56-16.77-12.56-16.77c0,0,11-6.53,31.46-7.9,10.62-.71,15.18.93,15.18.93Z" style="fill:#e5d8a3; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3281.04,452.61s19.31-22.37,19.55-45.45" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3298.23,446.12s8.95-19.78,10.6-28.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3308,450.6s4-.71,6.83-10.72" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3357.69,388.66s22.37-35.56,18.13-73.48" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3380.07,374.52s12.25-11.78,11.3-44.04" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3393.33,253.23s8.48-25.67-1.65-49.93" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3407.66,264.3s4.45-29.44,1.62-46.4" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3424.46,247.11s-2.36-13.19-2.36-18.84-4.73-14.48-4.73-14.48" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3398.35,173.16s-12.2-22,4.25-62.49" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3411.85,158.37s4.07-6.66,2.96-41.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3425.72,178.33s28.1-21.26,2.77-68.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3051.08,108.1s-3.51-3.88,5.73-21.63" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3063.83,116.42s0-16.25,7.77-38.09" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3589.49,145.67c-28.26-5.47-29.38,3.18-29.38,3.18,0,0-2.62,9.66-4.91,26.86s26.23,15.63,26.23,15.63c0,0,17.96-9.2,17.79-23.72s-9.73-21.95-9.73-21.95Z" style="fill:#eada96; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3218.23,13.9s2.9-2.69,3.2-8.91" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/></svg>`;

const leftHandSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3601.22 472.78"><g transform="scale(-1, 1) translate(-3601.22, 0)"><path d="M2,112.32l2616.99,20.58,163.88,3.49,54.16,2.42c.11,0,.22,0,.34-.01,2.33-.25,27.73-3.32,37.91-17.2s21.05-20.45,22.42-21.26c.09-.06.18-.1.28-.14l89.27-36.98s32.59-12.93,52.75-25.62c17.65-11.11,69.99-13.73,73.22-13.89.11,0,.21-.02.32-.04l63.98-12.62c.37-.07.72-.25,1.01-.5,4.75-3.99,9.67-3.52,11.71-3.09.65.14,1.31-.04,1.84-.45,11.25-8.69,25.23-3.74,28.58-2.35.5.21,1.05.22,1.56.06,4.93-1.58,6.43-.41,6.43-.41,26.06,14.85,51.3,8.62,53.06,8.16.07-.02.13-.04.2-.06,42.83-16.04,54.74-3.85,56.99-.67.29.41.43.91.4,1.41-2.14,34.4-33.95,52.45-33.95,52.45l-25.87,13.29c-1.94,1-1.43,3.9.73,4.18l142.8,18.26s153.39,12.2,172.56,52.29c18.59,38.86-39.81,44.97-43.4,45.3-.11.01-.22.01-.34,0l-130.56-7.83-105.49-7.49c-2.87-.2-3.3,4.07-.44,4.42,19.99,2.47,39.63,2.22,41.33,2.2.08,0,.16,0,.24-.02,61.98-8.22,74.51,22.77,75.62,25.91.06.16.09.33.11.5,6.01,57.29-16.59,65.02-16.59,65.02,0,0-9.59,8.81-51.42,2.71-31.32-4.57-69-2.3-85.95-.87-2.46.21-2.81,3.69-.43,4.35,7.37,2.06,14.98,2.56,15.73,2.61.04,0,.08,0,.12,0,93.49.02,106.35,33.42,107.1,35.62.03.08.04.15.06.23.37,1.75,4.64,23.81-8.74,53.54-13.94,30.99-139.44,0-139.44,0,0,0,75.82,16.07,77.56,40.48,1.6,22.38-9.99,35.96-11.93,38.06-.17.19-.37.34-.6.46-30.39,16.35-59.85,11.15-70.27,11.15s-131.25-5.91-135-6.1c-.06,0-.11,0-.17-.02-2-.27-39.44-5.22-81.84-5.22s-180.37-51.93-187.92-54.78c-.22-.08-.44-.13-.67-.14-59.95-2.68-101.65-22.65-119.92-23.52-18.3-.87-202.88,0-202.88,0L2.01,378.65V112.32Z" style="fill:#f8c0a5; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2737.42,372.57s-7.7-23.93,1.1-47.59" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2791.34,389.62s31.09-16.51,23.66-68.22" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2933.56,269.41s168.59,26.14,228.77,55.56" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2935.86,229.91s86.55-11.94,122.98-9.19c36.42,2.76,83.74-8.27,83.74-8.27,0,0,24.68-5.79,88.54-1.69" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3061.58,160.32s123.47-66.94,173.61-42.73" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M2991.71,77.07s31.03-27.64,72.71-37.15" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3178.11,10.94s-1.05,4.03,4.3,8.67" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3191.23,7.72s2.42,3.77,5.73,6.18" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3203.55,2.26s1.61,6.37,13.12,18.77,9.9,15.97,9.9,15.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3237.91,8.76s5.62,7.81,7.49,23.87" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3328.47,5.47v5.34c0,11.94-2.83,12.91-2.83,12.91,0,0-16.96,7.44-31.25,5.51s-12.56-16.77-12.56-16.77c0,0,11-6.53,31.46-7.9,10.62-.71,15.18.93,15.18.93Z" style="fill:#e5d8a3; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3281.04,452.61s19.31-22.37,19.55-45.45" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3298.23,446.12s8.95-19.78,10.6-28.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3308,450.6s4-.71,6.83-10.72" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3357.69,388.66s22.37-35.56,18.13-73.48" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3380.07,374.52s12.25-11.78,11.3-44.04" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3393.33,253.23s8.48-25.67-1.65-49.93" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3407.66,264.3s4.45-29.44,1.62-46.4" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3424.46,247.11s-2.36-13.19-2.36-18.84-4.73-14.48-4.73-14.48" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3398.35,173.16s-12.2-22,4.25-62.49" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3411.85,158.37s4.07-6.66,2.96-41.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3425.72,178.33s28.1-21.26,2.77-68.97" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3051.08,108.1s-3.51-3.88,5.73-21.63" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3063.83,116.42s0-16.25,7.77-38.09" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3589.49,145.67c-28.26-5.47-29.38,3.18-29.38,3.18,0,0-2.62,9.66-4.91,26.86s26.23,15.63,26.23,15.63c0,0,17.96-9.2,17.79-23.72s-9.73-21.95-9.73-21.95Z" style="fill:#eada96; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/><path d="M3218.23,13.9s2.9-2.69,3.2-8.91" style="fill:none; stroke:#000; stroke-miterlimit:10; stroke-width:4px;"/></g></svg>`;

let rightHandImg = null;
let leftHandImg = null;

function loadHandImages() {
  const loadSVG = (svg) => {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    return img;
  };
  rightHandImg = loadSVG(rightHandSVG);
  leftHandImg = loadSVG(leftHandSVG);
}

loadHandImages();

const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");

function initializeCanvases() {
  // Initialiser centerX et centerY en PREMIER
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;

  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  maskCtx.fillStyle = "white";
  maskCtx.font = "bold 1200px Helvetica";
  maskCtx.textAlign = "center";
  maskCtx.textBaseline = "middle";
  maskCtx.fillText("2", centerX, centerY);

  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
}

initializeCanvases();

window.addEventListener("resize", () => {
  initializeCanvases();
});

class Pimple {
  constructor(x, y, index) {
    this.x = x;
    this.y = y;
    this.size = (35 + Math.random() * 10) * 0.8;
    this.squeezing = false;
    this.squeezeTime = 0;
    this.exploding = false;
    this.explodeTime = 0;
    this.popped = false;
    this.jets = [];
    this.popInDelay = index * 2.4;
    this.popInProgress = 0;
    this.visible = false;
    this.splashCanvas = null;
    this.splashReady = false;
    this.edgeParticles = [];
    this.outsideParticles = [];
    this.fadeOutProgress = 0;
  }

  updatePopIn(dt, fadeIn) {
    if (fadeIn >= 1 && !this.visible) {
      this.popInProgress += dt * 8;
      if (this.popInProgress >= this.popInDelay + 0.2) {
        this.visible = true;
      }
    }
  }

  update(dt, mx, my, clicked, down) {
    if (!this.visible) return;

    const dist = Math.hypot(mx - this.x, my - this.y);

    if (clicked && dist < 40 && !this.squeezing && !this.popped) {
      this.squeezing = true;
      this.squeezeTime = 0;
      pressSound.currentTime = 0;
      pressSound.play();
    }

    // Annuler si on relâche OU si on s'éloigne trop du bouton
    if (this.squeezing && (!down || dist > 60)) {
      this.squeezing = false;
      this.squeezeTime = 0;
    }

    if (this.squeezing) {
      this.squeezeTime += dt;
      if (this.squeezeTime >= 1.5) {
        this.squeezing = false;
        this.exploding = true;
        this.explodeTime = 0;
        this.generateJets();
        explodeSound.currentTime = 0;
        explodeSound.play();
      }
    }

    if (this.exploding) {
      this.explodeTime += dt;
      for (let jet of this.jets)
        for (let p of jet) {
          p.offsetX += p.vx * dt;
          p.offsetY += p.vy * dt;
          const d = Math.pow(p.drag, dt * 60);
          p.vx *= d;
          p.vy *= d;
        }
      if (this.explodeTime >= 0.5) {
        this.exploding = false;
        this.popped = true;
        this.bakeSplash();
      }
    }

    if (this.popped && this.fadeOutProgress < 1) {
      this.fadeOutProgress = Math.min(this.fadeOutProgress + dt * 3, 1);
    }
  }

  generateJets() {
    this.jets = [];
    for (let j = 0; j < 12; j++) {
      const jetAngle = (j / 12) * TWO_PI;
      const particles = [];
      for (let i = 0; i < 25; i++) {
        const angle = jetAngle + (Math.random() - 0.5) * 0.4;
        const dist = Math.random();
        const [maxDist, size] =
          dist < 0.3
            ? [50 + Math.random() * 100, 8 + Math.random() * 8]
            : dist < 0.7
            ? [150 + Math.random() * 150, 5 + Math.random() * 6]
            : [300 + Math.random() * 200, 3 + Math.random() * 5];

        particles.push({
          offsetX: 0, // Position relative au bouton
          offsetY: 0,
          vx: Math.cos(angle) * maxDist * 2.4,
          vy: Math.sin(angle) * maxDist * 2.4,
          size,
          drag: 0.88 + Math.random() * 0.08,
        });
      }
      this.jets.push(particles);
    }
  }

  bakeSplash() {
    this.splashCanvas = document.createElement("canvas");
    this.splashCanvas.width = canvas.width;
    this.splashCanvas.height = canvas.height;
    const ctx = this.splashCanvas.getContext("2d");

    this.edgeParticles = [];
    this.outsideParticles = [];
    this.innerParticles = [];

    for (let jet of this.jets) {
      for (let p of jet) {
        const status = this.checkParticlePosition(p);
        // Stocker en position relative au centre (comme pimpleOffsets)
        const relativeParticle = {
          offsetX: p.offsetX + (this.x - centerX),
          offsetY: p.offsetY + (this.y - centerY),
          size: p.size,
        };
        if (status === "edge") this.edgeParticles.push(relativeParticle);
        else if (status === "outside")
          this.outsideParticles.push(relativeParticle);
        else this.innerParticles.push(relativeParticle);
      }
    }

    ctx.fillStyle = "rgba(231, 226, 200, 0.85)";
    ctx.beginPath();
    for (let p of this.innerParticles) {
      const px = centerX + p.offsetX;
      const py = centerY + p.offsetY;
      ctx.moveTo(px + p.size, py);
      ctx.arc(px, py, p.size, 0, TWO_PI);
    }
    ctx.fill();

    this.splashReady = true;
    this.fadeOutProgress = 0;
    // Sauvegarder les jets pour pouvoir recréer le splash après resize
    this.savedJets = this.jets;
    this.jets = [];
  }

  checkParticlePosition(p) {
    const checks = 6;
    let insideCount = 0;
    const px = this.x + p.offsetX;
    const py = this.y + p.offsetY;
    if (!this.maskImageData)
      this.maskImageData = maskCtx.getImageData(
        0,
        0,
        maskCanvas.width,
        maskCanvas.height
      );
    const data = this.maskImageData.data;

    for (let i = 0; i < checks; i++) {
      const angle = (i / checks) * TWO_PI;
      const checkX = Math.round(px + Math.cos(angle) * p.size);
      const checkY = Math.round(py + Math.sin(angle) * p.size);

      if (
        checkX >= 0 &&
        checkX < maskCanvas.width &&
        checkY >= 0 &&
        checkY < maskCanvas.height
      ) {
        if (data[(checkY * maskCanvas.width + checkX) * 4] > 128) insideCount++;
      }
    }
    return insideCount === 0
      ? "outside"
      : insideCount === checks
      ? "inside"
      : "edge";
  }

  drawSplash(ctx) {
    if (this.exploding) {
      ctx.fillStyle = "rgba(231, 226, 200, 0.85)";
      ctx.beginPath();
      for (let jet of this.jets) {
        for (let p of jet) {
          const px = this.x + p.offsetX;
          const py = this.y + p.offsetY;
          ctx.moveTo(px + p.size, py);
          ctx.arc(px, py, p.size, 0, TWO_PI);
        }
      }
      ctx.fill();
    }
  }

  drawButton(ctx) {
    if (!buttonImg.complete) return;

    let scale = 1;
    if (!this.visible && this.popInProgress > this.popInDelay) {
      const t = Math.min((this.popInProgress - this.popInDelay) / 0.2, 1);
      scale = t * t * (3 - 2 * t);
    } else if (!this.visible) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    if (this.squeezing) {
      const amt = this.squeezeTime / 1.5;
      ctx.scale(1 - amt * 0.15, 1 + amt * 0.5);
    }

    const imgSize = this.size * 4;
    ctx.drawImage(buttonImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
    ctx.restore();
  }
}

// centerX et centerY sont déjà définis dans initializeCanvases()
const tc = document.createElement("canvas");
tc.width = canvas.width;
tc.height = canvas.height;
const tctx = tc.getContext("2d");
tctx.fillStyle = "white";
tctx.font = "bold 1200px Helvetica";
tctx.textAlign = "center";
tctx.textBaseline = "middle";
tctx.fillText("2", centerX, centerY);

const img = tctx.getImageData(0, 0, tc.width, tc.height);
const validPos = [];
const margin = 40;

for (let y = margin; y < tc.height - margin; y += 15) {
  for (let x = margin; x < tc.width - margin; x += 15) {
    let ok = true;
    for (let dy = -40; dy <= 40 && ok; dy += 20) {
      for (let dx = -40; dx <= 40; dx += 20) {
        const cx = x + dx,
          cy = y + dy;
        if (
          cx >= 0 &&
          cx < tc.width &&
          cy >= 0 &&
          cy < tc.height &&
          img.data[(cy * tc.width + cx) * 4] < 128
        ) {
          ok = false;
          break;
        }
      }
    }
    if (ok) validPos.push({ x, y });
  }
}

const num = 5;
for (let i = 0; i < num && validPos.length > 0; i++) {
  const idx = Math.floor(Math.random() * validPos.length);
  const pos = validPos.splice(idx, 1)[0];
  pimpleOffsets.push({ x: pos.x - centerX, y: pos.y - centerY });
  pimples.push(new Pimple(pos.x, pos.y, i));

  for (let j = validPos.length - 1; j >= 0; j--) {
    if (Math.hypot(validPos[j].x - pos.x, validPos[j].y - pos.y) < 250) {
      validPos.splice(j, 1);
    }
  }
}

window.addEventListener("resize", () => {
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;

  pimples.forEach((p, i) => {
    p.x = centerX + pimpleOffsets[i].x;
    p.y = centerY + pimpleOffsets[i].y;

    // Recréer le splashCanvas avec les nouvelles coordonnées
    if (p.splashReady && p.edgeParticles && p.edgeParticles.length > 0) {
      // Redessiner le splashCanvas avec centerX/centerY à jour
      p.splashCanvas.width = canvas.width;
      p.splashCanvas.height = canvas.height;
      const ctx = p.splashCanvas.getContext("2d");

      ctx.fillStyle = "rgba(231, 226, 200, 0.85)";
      ctx.beginPath();

      // Redessiner les particules internes avec les nouveaux centres
      // On doit les recalculer depuis edgeParticles et outsideParticles
      // En fait, stockons aussi les innerParticles
      if (p.innerParticles) {
        for (let particle of p.innerParticles) {
          const px = centerX + particle.offsetX;
          const py = centerY + particle.offsetY;
          ctx.moveTo(px + particle.size, py);
          ctx.arc(px, py, particle.size, 0, TWO_PI);
        }
        ctx.fill();
      }
    }
  });
});

function update(dt) {
  // Limiter dt pour éviter les sauts d'animation
  dt = Math.min(dt, 0.05);

  time += dt;
  let mx = input.getX(),
    my = input.getY();
  const down = input.isPressed();
  const clicked = down && !wasDown;
  wasDown = down;

  // Utiliser le centre si le curseur n'a pas encore été détecté
  const cursorActive = input.hasStarted();

  // Initialiser les springs des mains à la position actuelle du curseur
  // seulement quand le curseur est détecté pour la première fois
  if (!handsInitialized && cursorActive) {
    handXSpring.position = mx;
    handXSpring.velocity = 0;
    handYSpring.position = my;
    handYSpring.velocity = 0;
    handsInitialized = true;
  }

  // Mettre à jour les springs pour suivre le curseur (seulement si initialisé)
  if (handsInitialized) {
    handXSpring.target = mx;
    handYSpring.target = my;
    handXSpring.step(dt);
    handYSpring.step(dt);
  }

  // Positions lissées pour les mains
  const handMx = handsInitialized ? handXSpring.position : 0;
  const handMy = handsInitialized ? handYSpring.position : 0;

  if (fadeIn < 1) fadeIn = Math.min(fadeIn + dt * 0.5, 1);
  if (cursorActive && handsIntroProgress < 1)
    handsIntroProgress = Math.min(handsIntroProgress + dt * 0.5, 1); // Animation sur 2 secondes

  pimples.forEach((p) => p.updatePopIn(dt, fadeIn));

  const allPopped = pimples.every((p) => p.popped);
  if (allPopped && allPoppedTime === -1) allPoppedTime = time;

  let fadeOut = 0;
  if (allPoppedTime !== -1) {
    const tsp = time - allPoppedTime;
    if (tsp > 1 && handsOutroProgress < 1)
      handsOutroProgress = Math.min(handsOutroProgress + dt * 1.5, 1);
    if (tsp > 2.5) fadeOut = Math.min((tsp - 2.5) * 2, 1);
    // Appeler finish() quand l'écran est complètement noir (fadeOut >= 1)
    if (fadeOut >= 1 && !finishCalled) {
      finishCalled = true;
      finish();
    }
  }

  let closest = Infinity;
  for (let p of pimples) {
    if (!p.popped && !p.squeezing && p.visible) {
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < closest) closest = d;
    }
  }

  fingerGapSpring.target =
    closest < 80 ? (closest < 40 ? 30 : 100 - (1 - closest / 80) * 60) : 100;
  if (down) fingerGapSpring.target = Math.min(fingerGapSpring.target, 15);
  fingerGapSpring.step(dt);
  pimples.forEach((p) => p.update(dt, mx, my, clicked, down));

  // Fond noir puis peau beige
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dessiner la peau (le fadeOut sera géré par l'overlay noir à la fin)
  const skinAlpha = fadeIn;
  if (skinAlpha > 0) {
    ctx.fillStyle = `rgba(248, 192, 165, ${skinAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

  pimples.forEach((p) => {
    if (p.exploding) p.drawSplash(ctx);
  });

  pimples.forEach((p) => {
    if (p.popped && p.splashReady) tempCtx.drawImage(p.splashCanvas, 0, 0);
  });
  tempCtx.globalCompositeOperation = "destination-in";
  tempCtx.drawImage(maskCanvas, 0, 0);
  tempCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(tempCanvas, 0, 0);

  pimples.forEach((p) => {
    if (
      p.popped &&
      p.outsideParticles &&
      p.fadeOutProgress < 1 &&
      p.outsideParticles.length > 0
    ) {
      const alpha = 0.85 * (1 - p.fadeOutProgress);
      ctx.fillStyle = `rgba(231, 226, 200, ${alpha})`;
      ctx.beginPath();
      for (let particle of p.outsideParticles) {
        const px = centerX + particle.offsetX;
        const py = centerY + particle.offsetY;
        ctx.moveTo(px + particle.size, py);
        ctx.arc(px, py, particle.size, 0, TWO_PI);
      }
      ctx.fill();
    }
  });

  pimples.forEach((p) => {
    if (p.exploding || p.popped) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.filter = "blur(12px)";
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 1.2, 0, TWO_PI);
      ctx.fill();
      ctx.filter = "none";
      ctx.restore();
    }
  });

  let hasEdgeParticles = pimples.some(
    (p) => p.popped && p.edgeParticles && p.edgeParticles.length > 0
  );
  if (hasEdgeParticles) {
    ctx.fillStyle = `rgba(231, 226, 200, 0.85)`;
    ctx.beginPath();
    pimples.forEach((p) => {
      if (p.popped && p.edgeParticles) {
        for (let particle of p.edgeParticles) {
          const px = centerX + particle.offsetX;
          const py = centerY + particle.offsetY;
          ctx.moveTo(px + particle.size, py);
          ctx.arc(px, py, particle.size, 0, TWO_PI);
        }
      }
    });
    ctx.fill();
  }

  // Dessiner les boutons
  pimples.forEach((p) => {
    if (!p.exploding && !p.popped) {
      p.drawButton(ctx);
    }
  });

  // Configuration des mains et bras (toujours affichées)
  const gap = fingerGapSpring.position,
    handWidth = 2400,
    handHeight = 300,
    handOffset = 1200,
    fingerSpacing = 1200,
    armY = handMy - handHeight / 2 + 50 + 71.5;

  // Animations d'arrivee et depart avec smoothstep
  const intro =
    handsIntroProgress * handsIntroProgress * (3 - 2 * handsIntroProgress);
  const outro =
    handsOutroProgress * handsOutroProgress * (3 - 2 * handsOutroProgress);

  // Calcul des positions X des mains
  const leftHandX =
    handMx -
    handOffset +
    gap / 2 +
    fingerSpacing +
    canvas.width * (1 - intro) +
    canvas.width * outro;
  const rightHandX =
    handMx -
    handOffset -
    gap / 2 -
    fingerSpacing -
    canvas.width * (1 - intro) -
    canvas.width * outro;

  // Dessiner les mains
  if (leftHandImg?.complete)
    ctx.drawImage(
      leftHandImg,
      leftHandX,
      handMy - handHeight / 2 + 50,
      handWidth,
      handHeight
    );
  if (rightHandImg?.complete)
    ctx.drawImage(
      rightHandImg,
      rightHandX,
      handMy - handHeight / 2 + 50,
      handWidth,
      handHeight
    );

  // Dessiner les bras
  const armExtensionWidth = 3000;
  const armExtensionHeight = 169;
  const armColor = "#f8c0a5";

  // Bras gauche
  const leftArmX = leftHandX + handWidth - 80;
  const leftArmY = armY;

  ctx.fillStyle = armColor;
  ctx.fillRect(leftArmX, leftArmY, armExtensionWidth, armExtensionHeight);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftArmX, leftArmY);
  ctx.lineTo(leftArmX + armExtensionWidth, leftArmY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(leftArmX, leftArmY + armExtensionHeight);
  ctx.lineTo(leftArmX + armExtensionWidth, leftArmY + armExtensionHeight);
  ctx.stroke();

  // Bras droit
  const rightArmX = rightHandX - armExtensionWidth + 80;
  const rightArmY = armY;

  ctx.fillStyle = armColor;
  ctx.fillRect(rightArmX, rightArmY, armExtensionWidth, armExtensionHeight);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rightArmX, rightArmY);
  ctx.lineTo(rightArmX + armExtensionWidth, rightArmY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightArmX, rightArmY + armExtensionHeight);
  ctx.lineTo(rightArmX + armExtensionWidth, rightArmY + armExtensionHeight);
  ctx.stroke();

  // Overlay noir pour le fadeOut final (dessiner PAR-DESSUS tout le contenu)
  if (fadeOut > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeOut})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

run(update);
