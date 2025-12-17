import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

const grid = document.getElementById("grid");
const wrapper = document.getElementById("wrapper");

let gridSize = 1;
const maxGridSize = 20;
let canScroll = false;
let outroStarted = false;
let outroScheduled = false;
let outroTimer = null;

// Son pour les interactions
const clickSound = new Audio("./click.mp3");
clickSound.preload = "auto";

function playClickSound() {
  const sound = clickSound.cloneNode();
  sound.volume = 0.09;
  sound.play().catch((e) => console.log("Audio play failed:", e));
}

// Pattern pour former le chiffre "1" sur une grille 20x20
// 0 = zoom à 20%, 1 = zoom à 50% (bordure), 2 = zoom à 100% (centre)
const pattern2 = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function createGrid(size) {
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

  const totalImages = size * size;

  for (let i = 0; i < totalImages; i++) {
    const container = document.createElement("div");
    container.className = "image-container";

    const img = document.createElement("img");
    img.src = "./CLICK.png";
    img.alt = "";
    img.dataset.index = i;

    container.appendChild(img);

    container.addEventListener("click", () => {
      playClickSound();
      if (gridSize < maxGridSize) {
        gridSize++;
        createGrid(gridSize);

        if (gridSize === maxGridSize) {
          canScroll = true;
          swapToScrollImages();
        }
      } else {
        canScroll = true;
        swapToScrollImages();
      }
    });

    grid.appendChild(container);
  }
}

let scrollProgress = 0;
let lastScrollTime = 0;

window.addEventListener("wheel", (e) => {
  if (!canScroll || gridSize !== maxGridSize) return;

  e.preventDefault();

  // Jouer le son à chaque scroll, mais pas trop rapidement
  const now = Date.now();
  if (now - lastScrollTime > 50) {
    playClickSound();
    lastScrollTime = now;
  }

  scrollProgress += e.deltaY * 0.001;
  scrollProgress = Math.max(0, Math.min(1, scrollProgress));

  updateZoom();
});

function updateZoom() {
  const containers = grid.querySelectorAll(".image-container");

  containers.forEach((container, index) => {
    const img = container.querySelector("img");
    const row = Math.floor(index / maxGridSize);
    const col = index % maxGridSize;

    const patternValue = pattern2[row] && pattern2[row][col];

    let scale = 1;

    if (patternValue === 0) {
      scale = 1 + scrollProgress * 1;
    } else if (patternValue === 1) {
      scale = 1 + scrollProgress * 20;
    } else if (patternValue === 2) {
      scale = 1 + scrollProgress * 30;
    }

    img.style.transform = `scale(${scale})`;
  });

  if (scrollProgress >= 1) {
    if (!outroStarted && !outroScheduled) {
      outroScheduled = true;
      outroTimer = setTimeout(() => {
        if (!outroStarted) startOutro();
      }, 5000);
    }
  } else {
    if (outroScheduled && !outroStarted) {
      clearTimeout(outroTimer);
      outroTimer = null;
      outroScheduled = false;
    }
  }
}

function swapToScrollImages() {
  const imgs = grid.querySelectorAll(".image-container img");
  imgs.forEach((img) => {
    img.src = "./SCROLL.png";
  });
}

function startOutro() {
  outroStarted = true;
  outroScheduled = false;
  if (outroTimer) {
    clearTimeout(outroTimer);
    outroTimer = null;
  }
  canScroll = false;

  const imgs = grid.querySelectorAll(".image-container img");

  imgs.forEach((img) => {
    img.style.transition = "transform 0.8s ease, opacity 0.8s ease";
    img.style.transform = "scale(0)";
  });

  setTimeout(() => {
    grid.innerHTML = "";
  }, 800);
  setTimeout(() => {
    finish();
  }, 1000);
}

// Démarre automatiquement
createGrid(gridSize);
