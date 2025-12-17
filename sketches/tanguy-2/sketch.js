import { createEngine } from "../_shared/engine.js";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);
// Change cursor to a crosshair when over the canvas
canvas.style.cursor = "crosshair";

// Fonction pour convertir des coordonnées monde vers écran
function worldToScreen(
  ctxOrMatrix,
  oldX,
  oldY,
  { pixelDensity = devicePixelRatio } = {}
) {
  if (ctxOrMatrix instanceof CanvasRenderingContext2D)
    ctxOrMatrix = ctxOrMatrix.getTransform();
  const { x, y } = ctxOrMatrix.transformPoint(new DOMPoint(oldX, oldY));
  return { x: x / pixelDensity, y: y / pixelDensity };
}

// Fonction pour calculer la taille en pixels écran d'une dimension monde
function worldSizeToScreenSize(ctx, worldSize) {
  const transform = ctx.getTransform();
  // Calculer combien de pixels écran = worldSize pixels monde
  const screenSize = worldSize * transform.a; // transform.a est le scale X
  return screenSize / devicePixelRatio;
}

// Fonction pour garantir une taille minimale de 1 pixel écran
function ensureMinimumSize(ctx, worldSize, minScreenPixels = 1) {
  const screenSize = worldSizeToScreenSize(ctx, worldSize);
  if (screenSize < minScreenPixels) {
    // Calculer la taille monde nécessaire pour avoir minScreenPixels pixels écran
    const transform = ctx.getTransform();
    return (minScreenPixels * devicePixelRatio) / transform.a;
  }
  return worldSize;
}

// Audio sources
const tickAudio = "tick.wav";
const gaspAudio = "gasp.wav";

// Create audio pools
const tickPool = [];
const gaspPool = [];
const poolSize = 5;

for (let i = 0; i < poolSize; i++) {
  const tickSound = new Audio(tickAudio);
  const gaspSound = new Audio(gaspAudio);

  tickSound.addEventListener("error", (e) => {
    console.error("Error loading tick audio:", e);
  });

  gaspSound.addEventListener("error", (e) => {
    console.error("Error loading gasp audio:", e);
  });

  tickPool.push(tickSound);
  gaspPool.push(gaspSound);
}

console.log("Audio pools created:", {
  tickPool: tickPool.length,
  gaspPool: gaspPool.length,
});
let currentTickIndex = 0;
let currentGaspIndex = 0;

function playTick() {
  const sound = tickPool[currentTickIndex];
  sound.currentTime = 0;
  const playPromise = sound.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {});
  }
  currentTickIndex = (currentTickIndex + 1) % poolSize;
}

function playGasp() {
  console.log("playGasp() called!");
  const sound = gaspPool[currentGaspIndex];
  console.log("Sound object:", sound);
  sound.currentTime = 0;
  const playPromise = sound.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => console.log("Gasp playing successfully"))
      .catch((e) => console.error("Error playing gasp:", e));
  }
  currentGaspIndex = (currentGaspIndex + 1) % poolSize;
}

// Mouse tracking
let mouseX = -1;
let mouseY = -1;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener("mouseleave", () => {
  mouseX = -1;
  mouseY = -1;
});

// Grid configuration
const cols = 30;
const rows = 30;

// Track last hovered cell for audio
let lastHoveredCell = null;

// Animation states
let animationState = "moving"; // "moving", "waitingForHover", "merging", "darkening", "waiting", "finished"
let mergeProgress = 0;
const mergeDuration = 1.0; // 1 seconde pour l'animation de fusion
let darkeningProgress = 0;
const darkeningDuration = 0; // 0.5 secondes pour le fondu au noir
let waitingStartTime = null;

// Pattern de destination finale - chaque "1" = position finale d'UN insecte
const two = [
  [0, 1, 1, 1, 0],
  [0, 0, 0, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [1, 1, 1, 1, 1],
];

// Classe Insecte
class Insect {
  constructor(startCol, startRow, endCol, endRow) {
    // Position discrète de grille
    this.currentCol = startCol;
    this.currentRow = startRow;
    // Position continue pour l'animation (en coordonnées de grille, float)
    this.currentX = startCol;
    this.currentY = startRow;
    // Position finale
    this.endCol = endCol;
    this.endRow = endRow;
    this.path = this.calculatePath();
    this.pathIndex = 0;
    this.isMoving = false;
    this.moveSpeed = 10; // Cases par seconde

    // Gasp animation
    this.isGasping = false;
    this.gaspProgress = 0;
    this.gaspDuration = 0.5; // 0.25 secondes
    this.wasInLightZone = false; // Pour détecter l'entrée dans la zone
  }

  calculatePath() {
    // Pathfinding simple : on va progressivement vers la destination
    const path = [];
    let col = this.currentCol;
    let row = this.currentRow;

    while (col !== this.endCol || row !== this.endRow) {
      path.push({ col, row });

      // Déplacement vers la destination
      if (col < this.endCol) col++;
      else if (col > this.endCol) col--;
      else if (row < this.endRow) row++;
      else if (row > this.endRow) row--;
    }

    path.push({ col: this.endCol, row: this.endRow });
    return path;
  }

  isInLightZone(lightSquares) {
    return lightSquares.some(
      (sq) => sq.col === this.currentCol && sq.row === this.currentRow
    );
  }

  update(dt, lightSquares) {
    if (this.hasReachedDestination()) {
      // Snap final à la position exacte
      this.currentX = this.endCol;
      this.currentY = this.endRow;
      return;
    }

    const inLightZone = this.isInLightZone(lightSquares);

    // Debug: afficher l'état de l'insecte
    if (inLightZone && !this.wasInLightZone) {
      console.log("Insect entering light zone!", {
        currentCol: this.currentCol,
        currentRow: this.currentRow,
        wasInLightZone: this.wasInLightZone,
        isGasping: this.isGasping,
        lightSquares: lightSquares.length,
      });
    }

    // Détecter l'entrée dans la zone lumineuse (uniquement si on n'était pas déjà dedans)
    if (inLightZone && !this.wasInLightZone && !this.isGasping) {
      // Démarrer l'animation de gasp
      this.isGasping = true;
      this.gaspProgress = 0;
      console.log(
        "GASP triggered for insect at",
        this.currentCol,
        this.currentRow
      );
      playGasp();
    }

    // Mettre à jour l'état APRÈS la vérification
    this.wasInLightZone = inLightZone;

    // Gérer l'animation de gasp
    if (this.isGasping) {
      this.gaspProgress += dt / this.gaspDuration;

      if (this.gaspProgress >= 1) {
        this.gaspProgress = 1;
        this.isGasping = false;
        // Après le gasp, commencer à bouger
        this.isMoving = true;
      }
      // Pendant le gasp, on ne bouge pas
      return;
    }

    // Si on est dans la lumière, on doit fuir (après le gasp)
    if (inLightZone && this.pathIndex < this.path.length - 1) {
      this.isMoving = true;
    }

    if (this.isMoving) {
      // Position cible (prochaine case sur le chemin)
      const nextPathIndex = Math.min(this.pathIndex + 1, this.path.length - 1);
      const target = this.path[nextPathIndex];
      const targetX = target.col;
      const targetY = target.row;

      // Calculer direction
      const dx = targetX - this.currentX;
      const dy = targetY - this.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.01) {
        // Se déplacer vers la cible
        const moveDistance = this.moveSpeed * dt;
        const ratio = Math.min(moveDistance / distance, 1);

        this.currentX += dx * ratio;
        this.currentY += dy * ratio;

        // Mettre à jour la position discrète
        this.currentCol = Math.round(this.currentX);
        this.currentRow = Math.round(this.currentY);
      } else {
        // On est arrivé à la prochaine case - SNAP à la position exacte
        this.currentX = targetX;
        this.currentY = targetY;
        this.currentCol = targetX;
        this.currentRow = targetY;
        this.pathIndex = nextPathIndex;

        // Vérifier si on est sorti de la lumière
        if (!this.isInLightZone(lightSquares)) {
          this.isMoving = false;
        }
      }
    }
  }

  hasReachedDestination() {
    return this.currentCol === this.endCol && this.currentRow === this.endRow;
  }

  getScale() {
    if (this.isGasping) {
      // Animation de scale de 1.0 à 1.1
      return 1.0 + 0.1 * this.gaspProgress;
    }
    return 1.0;
  }
}

// Créer les insectes
const insects = [];

function getVisibleGridBounds() {
  const cellSize = Math.max(canvas.width / cols, canvas.height / rows);
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = (canvas.width - gridWidth) / 2;
  const startY = (canvas.height - gridHeight) / 2;

  // Calculer les limites visibles de la grille
  const minVisibleCol = Math.max(0, Math.ceil(-startX / cellSize));
  const maxVisibleCol = Math.min(
    cols - 1,
    Math.floor((canvas.width - startX) / cellSize) - 1
  );
  const minVisibleRow = Math.max(0, Math.ceil(-startY / cellSize));
  const maxVisibleRow = Math.min(
    rows - 1,
    Math.floor((canvas.height - startY) / cellSize) - 1
  );

  return { minVisibleCol, maxVisibleCol, minVisibleRow, maxVisibleRow };
}

function initializeInsects() {
  insects.length = 0;

  const { minVisibleCol, maxVisibleCol, minVisibleRow, maxVisibleRow } =
    getVisibleGridBounds();

  // Parcourir la matrice "two" et créer UN insecte par "1" trouvé
  for (let row = 0; row < two.length; row++) {
    for (let col = 0; col < two[row].length; col++) {
      if (two[row][col] === 1) {
        // Calculer la position finale unique de cet insecte (centrée sur la grille)
        const finalCol = Math.floor(cols / 2) - 2 + col;
        const finalRow = Math.floor(rows / 2) - 2 + row;

        // Position initiale aléatoire DANS LA ZONE VISIBLE
        let startCol, startRow;
        do {
          startCol =
            Math.floor(Math.random() * (maxVisibleCol - minVisibleCol + 1)) +
            minVisibleCol;
          startRow =
            Math.floor(Math.random() * (maxVisibleRow - minVisibleRow + 1)) +
            minVisibleRow;
        } while (startCol === finalCol && startRow === finalRow);

        // Créer l'insecte avec SA position finale unique
        insects.push(new Insect(startCol, startRow, finalCol, finalRow));
      }
    }
  }
}

initializeInsects();

function update(dt) {
  // Calculer la taille de cellule pour couvrir AU MOINS tout l'écran
  const cellSize = Math.max(canvas.width / cols, canvas.height / rows);
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = (canvas.width - gridWidth) / 2;
  const startY = (canvas.height - gridHeight) / 2;

  // Clear canvas (noir)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Trouver la zone 5x5 centrée sur le carré le plus proche du curseur
  let closestSquares = [];
  let centerCol = -1;
  let centerRow = -1;

  // Si l'animation n'est plus en mode "moving", bloquer le carré au centre
  if (animationState !== "moving" && animationState !== "waitingForHover") {
    centerCol = Math.floor(cols / 2);
    centerRow = Math.floor(rows / 2);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const col = centerCol + dx;
        const row = centerRow + dy;

        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          closestSquares.push({ col, row });
        }
      }
    }
  } else if (
    mouseX >= startX &&
    mouseX < startX + gridWidth &&
    mouseY >= startY &&
    mouseY < startY + gridHeight
  ) {
    const relX = mouseX - startX;
    const relY = mouseY - startY;

    centerCol = Math.floor(relX / cellSize);
    centerRow = Math.floor(relY / cellSize);

    const cellKey = `${centerCol},${centerRow}`;
    if (cellKey !== lastHoveredCell) {
      playTick();
      lastHoveredCell = cellKey;
    }

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const col = centerCol + dx;
        const row = centerRow + dy;

        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          closestSquares.push({ col, row });
        }
      }
    }
  } else {
    lastHoveredCell = null;
  }

  // S'assurer que cellSize fait au moins 1 pixel à l'écran
  const minCellSize = ensureMinimumSize(ctx, cellSize);

  // Remplir les carrés de la zone 5x5 (lumière) avec interpolation pour le fondu
  if (animationState === "darkening") {
    // Interpoler de blanc vers noir
    const grayValue = Math.floor(255 * (1 - darkeningProgress));
    ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;

    closestSquares.forEach((sq) => {
      const x = startX + sq.col * cellSize;
      const y = startY + sq.row * cellSize;
      // Utiliser minCellSize pour garantir au moins 1 pixel
      ctx.fillRect(x, y, minCellSize, minCellSize);
    });
  } else if (animationState !== "waiting" && animationState !== "finished") {
    // Afficher la zone blanche normalement
    closestSquares.forEach((sq) => {
      const x = startX + sq.col * cellSize;
      const y = startY + sq.row * cellSize;

      ctx.fillStyle = "white";
      // Utiliser minCellSize pour garantir au moins 1 pixel
      ctx.fillRect(x, y, minCellSize, minCellSize);
    });
  }

  // Dessiner les lignes de grille autour de la zone 5x5
  if (
    closestSquares.length > 0 &&
    animationState !== "darkening" &&
    animationState !== "waiting" &&
    animationState !== "finished"
  ) {
    const minColGrid = Math.min(...closestSquares.map((sq) => sq.col));
    const maxColGrid = Math.max(...closestSquares.map((sq) => sq.col));
    const minRowGrid = Math.min(...closestSquares.map((sq) => sq.row));
    const maxRowGrid = Math.max(...closestSquares.map((sq) => sq.row));

    // Calculer l'épaisseur de ligne minimale (au moins 1 pixel écran)
    const transform = ctx.getTransform();
    const minLineWidth = devicePixelRatio / transform.a;
    const lineWidth = Math.max(1, minLineWidth); // Au moins 2 pixels monde ou 1 pixel écran

    ctx.strokeStyle = "#999"; // Gris foncé
    ctx.lineWidth = lineWidth;

    // Dessiner les lignes verticales
    for (let col = minColGrid; col <= maxColGrid + 1; col++) {
      const x = startX + col * cellSize;
      const y1 = startY + minRowGrid * cellSize;
      const y2 = startY + (maxRowGrid + 1) * cellSize;

      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }

    // Dessiner les lignes horizontales
    for (let row = minRowGrid; row <= maxRowGrid + 1; row++) {
      const y = startY + row * cellSize;
      const x1 = startX + minColGrid * cellSize;
      const x2 = startX + (maxColGrid + 1) * cellSize;

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
  }

  // Mettre à jour les insectes selon l'état de l'animation
  if (animationState === "moving") {
    insects.forEach((insect) => {
      insect.update(dt, closestSquares);
    });

    // Vérifier si tous les insectes ont atteint leur destination
    const allReached = insects.every((insect) =>
      insect.hasReachedDestination()
    );
    if (allReached) {
      // S'assurer que TOUS les insectes sont exactement à leur position finale
      insects.forEach((insect) => {
        insect.currentX = insect.endCol;
        insect.currentY = insect.endRow;
        insect.currentCol = insect.endCol;
        insect.currentRow = insect.endRow;
      });
      animationState = "waitingForHover";
    }
  } else if (animationState === "waitingForHover") {
    // Attendre que l'utilisateur survole la cellule centrale
    const centerCol = Math.floor(cols / 2);
    const centerRow = Math.floor(rows / 2);

    // Vérifier si la souris est dans la grille
    if (
      mouseX >= startX &&
      mouseX < startX + gridWidth &&
      mouseY >= startY &&
      mouseY < startY + gridHeight
    ) {
      const relX = mouseX - startX;
      const relY = mouseY - startY;

      const hoveredCol = Math.floor(relX / cellSize);
      const hoveredRow = Math.floor(relY / cellSize);

      // Si la cellule survolée est la cellule centrale, démarrer l'animation de fusion
      if (hoveredCol === centerCol && hoveredRow === centerRow) {
        animationState = "merging";
      }
    }
  } else if (animationState === "merging") {
    // Animation de fusion
    mergeProgress += dt / mergeDuration;

    if (mergeProgress >= 1) {
      mergeProgress = 1;
      animationState = "darkening";
    }
  } else if (animationState === "darkening") {
    // Animation du fondu au noir de la zone 5x5
    setTimeout(() => {
      darkeningProgress += dt / darkeningDuration;
    }, 1000);

    if (darkeningProgress >= 1) {
      darkeningProgress = 1;
      animationState = "waiting";
      waitingStartTime = Date.now();
    }
  } else if (animationState === "waiting") {
    // Attendre 1 seconde avant d'appeler finish()
    if (Date.now() - waitingStartTime >= 500) {
      animationState = "finished";
      finish();
    }
  }

  // Dessiner les insectes
  ctx.fillStyle = "black";

  insects.forEach((insect) => {
    // Position du centre de la cellule
    const cellCenterX = startX + insect.currentX * cellSize + cellSize / 2;
    const cellCenterY = startY + insect.currentY * cellSize + cellSize / 2;

    // Calculer la taille en fonction de l'état
    let insectSize;
    if (animationState === "moving" || animationState === "waitingForHover") {
      // Taille normale : 50% de la cellule
      insectSize = cellSize * 0.5;
    } else if (animationState === "merging") {
      // Interpoler de 50% à 100% de la cellule
      const startSize = cellSize * 0.5;
      const endSize = cellSize * 1.0;
      insectSize = startSize + (endSize - startSize) * mergeProgress;
    } else {
      // Taille finale : 100% de la cellule
      insectSize = cellSize * 1.0;
    }

    // Appliquer le scale du gasp
    const scale = insect.getScale();
    insectSize *= scale;

    // S'assurer que l'insecte fait au moins 1 pixel à l'écran
    const minInsectSize = ensureMinimumSize(ctx, insectSize);

    // Dessiner l'insecte centré
    const x = cellCenterX - minInsectSize / 2;
    const y = cellCenterY - minInsectSize / 2;

    ctx.fillRect(x, y, minInsectSize, minInsectSize);
  });
}
