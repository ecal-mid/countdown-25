import { createEngine } from "../_shared/engine.js";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);

// Audio sources
const basicSquareAudio = "fast-whoosh-fx.wav";
const tickAudio = "tick.wav";

// Create audio pools
const whooshPool = [];
const tickPool = [];
const poolSize = 5;

for (let i = 0; i < poolSize; i++) {
  whooshPool.push(new Audio(basicSquareAudio));
  tickPool.push(new Audio(tickAudio));
}
let currentWhooshIndex = 0;
let currentTickIndex = 0;

function playWhoosh() {
  const sound = whooshPool[currentWhooshIndex];
  sound.currentTime = 0;
  const playPromise = sound.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {});
  }
  currentWhooshIndex = (currentWhooshIndex + 1) % poolSize;
}

function playTick() {
  const sound = tickPool[currentTickIndex];
  sound.currentTime = 0;
  const playPromise = sound.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {});
  }
  currentTickIndex = (currentTickIndex + 1) % poolSize;
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
let lastHoveredSquare = null;

// Animation states
let animationState = "moving"; // "moving", "merging", "finished"
let mergeProgress = 0;
const mergeDuration = 1.0; // 1 seconde pour l'animation de fusion

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
    this.moveSpeed = 3; // Cases par seconde
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

    // Si on est dans la lumière, on doit fuir
    if (
      this.isInLightZone(lightSquares) &&
      this.pathIndex < this.path.length - 1
    ) {
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

  if (
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

  // Détecter changement de zone 5x5 pour whoosh
  if (closestSquares.length > 0) {
    const squareKeys = closestSquares
      .map((sq) => `${sq.col},${sq.row}`)
      .sort()
      .join("|");

    if (squareKeys !== lastHoveredSquare) {
      playWhoosh();
      lastHoveredSquare = squareKeys;
    }
  } else {
    lastHoveredSquare = null;
  }

  // Remplir les carrés de la zone 5x5 (lumière)
  closestSquares.forEach((sq) => {
    const x = startX + sq.col * cellSize;
    const y = startY + sq.row * cellSize;

    ctx.fillStyle = "white";
    ctx.fillRect(x, y, cellSize, cellSize);
  });

  // Dessiner les lignes de grille autour de la zone 5x5 et les ondes perpendiculaires
  if (closestSquares.length > 0) {
    const minColGrid = Math.min(...closestSquares.map((sq) => sq.col));
    const maxColGrid = Math.max(...closestSquares.map((sq) => sq.col));
    const minRowGrid = Math.min(...closestSquares.map((sq) => sq.row));
    const maxRowGrid = Math.max(...closestSquares.map((sq) => sq.row));

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    // Paramètres pour les fonctions linéaires (y = mx + c)
    const segments = 100; // Nombre de segments pour la courbe

    // Calculer les positions des barres du carré 5x5
    const topY = startY + minRowGrid * cellSize;
    const bottomY = startY + (maxRowGrid + 1) * cellSize;
    const leftX = startX + minColGrid * cellSize;
    const rightX = startX + (maxColGrid + 1) * cellSize;

    // Barres verticales du carré 5x5 avec ondes
    // Barre gauche avec fonction linéaire
    ctx.beginPath();
    let leftSlopeFactor = 1;
    if (centerCol >= 0) {
      const distFromCursor = Math.abs(minColGrid - centerCol);
      leftSlopeFactor = distFromCursor / (cols / 2);
    }
    for (let i = 0; i <= segments; i++) {
      const segmentT = i / segments;
      const y = startY + segmentT * gridHeight;

      let t = 0;
      let maxDist = 0;
      if (y < topY) {
        maxDist = topY - startY;
        t = (topY - y) / maxDist;
      } else if (y > bottomY) {
        maxDist = startY + gridHeight - bottomY;
        t = (y - bottomY) / maxDist;
      }

      const maxOffset = cellSize * 0.5;
      const offset = -maxOffset * t * leftSlopeFactor;
      const xWave = leftX + offset;

      if (i === 0) {
        ctx.moveTo(xWave, y);
      } else {
        ctx.lineTo(xWave, y);
      }
    }
    ctx.stroke();

    // Barre droite avec fonction linéaire
    ctx.beginPath();
    let rightSlopeFactor = 1;
    if (centerCol >= 0) {
      const distFromCursor = Math.abs(maxColGrid + 1 - centerCol);
      rightSlopeFactor = distFromCursor / (cols / 2);
    }
    for (let i = 0; i <= segments; i++) {
      const segmentT = i / segments;
      const y = startY + segmentT * gridHeight;

      let t = 0;
      let maxDist = 0;
      if (y < topY) {
        maxDist = topY - startY;
        t = (topY - y) / maxDist;
      } else if (y > bottomY) {
        maxDist = startY + gridHeight - bottomY;
        t = (y - bottomY) / maxDist;
      }

      const maxOffset = cellSize * 0.5;
      const offset = -maxOffset * t * rightSlopeFactor;
      const xWave = rightX + offset;

      if (i === 0) {
        ctx.moveTo(xWave, y);
      } else {
        ctx.lineTo(xWave, y);
      }
    }
    ctx.stroke();

    // Barres horizontales du carré 5x5 avec ondes
    // Barre haute avec fonction linéaire
    ctx.beginPath();
    let topSlopeFactor = 1;
    if (centerRow >= 0) {
      const distFromCursor = Math.abs(minRowGrid - centerRow);
      topSlopeFactor = distFromCursor / (rows / 2);
    }
    for (let i = 0; i <= segments; i++) {
      const segmentT = i / segments;
      const x = startX + segmentT * gridWidth;

      let t = 0;
      let maxDist = 0;
      if (x < leftX) {
        maxDist = leftX - startX;
        t = (leftX - x) / maxDist;
      } else if (x > rightX) {
        maxDist = startX + gridWidth - rightX;
        t = (x - rightX) / maxDist;
      }

      const maxOffset = cellSize * 0.5;
      const offset = maxOffset * t * topSlopeFactor;
      const yWave = topY + offset;

      if (i === 0) {
        ctx.moveTo(x, yWave);
      } else {
        ctx.lineTo(x, yWave);
      }
    }
    ctx.stroke();

    // Barre basse avec fonction linéaire
    ctx.beginPath();
    let bottomSlopeFactor = 1;
    if (centerRow >= 0) {
      const distFromCursor = Math.abs(maxRowGrid + 1 - centerRow);
      bottomSlopeFactor = distFromCursor / (rows / 2);
    }
    for (let i = 0; i <= segments; i++) {
      const segmentT = i / segments;
      const x = startX + segmentT * gridWidth;

      let t = 0;
      let maxDist = 0;
      if (x < leftX) {
        maxDist = leftX - startX;
        t = (leftX - x) / maxDist;
      } else if (x > rightX) {
        maxDist = startX + gridWidth - rightX;
        t = (x - rightX) / maxDist;
      }

      const maxOffset = cellSize * 0.5;
      const offset = maxOffset * t * bottomSlopeFactor;
      const yWave = bottomY + offset;

      if (i === 0) {
        ctx.moveTo(x, yWave);
      } else {
        ctx.lineTo(x, yWave);
      }
    }
    ctx.stroke();

    // Dessiner les lignes verticales perpendiculaires aux barres horizontales (haut et bas)
    for (let col = 0; col < cols; col++) {
      const x = startX + col * cellSize;

      // Ligne linéaire verticale (y = mx + c)
      ctx.beginPath();

      // Facteur de pente basé sur la distance horizontale depuis le curseur
      let slopeFactor = 1;
      if (centerCol >= 0) {
        const distFromCursor = Math.abs(col - centerCol);
        slopeFactor = distFromCursor / (cols / 2); // Normaliser entre 0 et ~2
      }

      for (let i = 0; i <= segments; i++) {
        const segmentT = i / segments;
        const y = startY + segmentT * gridHeight;

        // Calculer t depuis les bords du carré 5x5
        let t = 0;
        let maxDist = 0;

        if (y < topY) {
          // Au-dessus du carré - origine à topY
          maxDist = topY - startY;
          t = (topY - y) / maxDist;
        } else if (y > bottomY) {
          // En-dessous du carré - origine à bottomY
          maxDist = startY + gridHeight - bottomY;
          t = (y - bottomY) / maxDist;
        } else {
          // À l'intérieur du carré 5x5
          t = 0;
        }

        // Fonction linéaire: offset = m * t (départ à 0, arrive à 50% cellSize)
        const maxOffset = cellSize * 0.5;
        const offset = -maxOffset * t * slopeFactor; // Pente inverse multipliée par facteur curseur

        const xWave = x + offset;

        if (i === 0) {
          ctx.moveTo(xWave, y);
        } else {
          ctx.lineTo(xWave, y);
        }
      }
      ctx.stroke();
    }

    // Dessiner les lignes horizontales perpendiculaires aux barres verticales (gauche et droite)
    for (let row = 0; row < rows; row++) {
      const y = startY + row * cellSize;

      // Ligne linéaire horizontale (y = mx + c)
      ctx.beginPath();

      // Facteur de pente basé sur la distance verticale depuis le curseur
      let slopeFactor = 1;
      if (centerRow >= 0) {
        const distFromCursor = Math.abs(row - centerRow);
        slopeFactor = distFromCursor / (rows / 2); // Normaliser entre 0 et ~2
      }

      for (let i = 0; i <= segments; i++) {
        const segmentT = i / segments;
        const x = startX + segmentT * gridWidth;

        // Calculer t depuis les bords du carré 5x5
        let t = 0;
        let maxDist = 0;

        if (x < leftX) {
          // À gauche du carré - origine à leftX
          maxDist = leftX - startX;
          t = (leftX - x) / maxDist;
        } else if (x > rightX) {
          // À droite du carré - origine à rightX
          maxDist = startX + gridWidth - rightX;
          t = (x - rightX) / maxDist;
        } else {
          // À l'intérieur du carré 5x5
          t = 0;
        }

        // Fonction linéaire: offset = m * t (départ à 0, arrive à 50% cellSize)
        const maxOffset = cellSize * 0.5;
        const offset = maxOffset * t * slopeFactor; // Pente positive multipliée par facteur curseur

        const yWave = y + offset;

        if (i === 0) {
          ctx.moveTo(x, yWave);
        } else {
          ctx.lineTo(x, yWave);
        }
      }
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
      animationState = "merging";
    }
  } else if (animationState === "merging") {
    // Animation de fusion
    mergeProgress += dt / mergeDuration;

    if (mergeProgress >= 1) {
      mergeProgress = 1;
      animationState = "finished";
      // finish();
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
    if (animationState === "moving") {
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

    // Dessiner l'insecte centré
    const x = cellCenterX - insectSize / 2;
    const y = cellCenterY - insectSize / 2;

    ctx.fillRect(x, y, insectSize, insectSize);
  });
}
