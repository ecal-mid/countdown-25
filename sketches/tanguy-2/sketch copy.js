import { createEngine } from "../_shared/engine.js";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);

// Audio sources
const basicSquareAudio = "fast-whoosh-fx.wav";
const secretAudio = "industrial-fx.wav";
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

// Précharger l'audio secret
const secretSound = new Audio(secretAudio);

function playWhoosh() {
  const sound = whooshPool[currentWhooshIndex];
  sound.currentTime = 0;
  const playPromise = sound.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {});
  }
  currentWhooshIndex = (currentWhooshIndex + 1) % poolSize;
}

function playSecret() {
  secretSound.currentTime = 0;
  const playPromise = secretSound.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {});
  }
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

// Zone de génération des symboles (dans la window visible)
// IMPORTANT: minRow doit être au moins 4 pour éviter que les chemins sortent par le haut
const minCol = 5;
const maxCol = 25;
const minRow = 4; // Augmenté à 4 pour marge de sécurité (les chemins ne peuvent pas aller en row 0, 1, 2, 3)
const maxRow = 13; // Réduit légèrement pour équilibrer la zone

// CONTRAINTE ABSOLUE: aucun chemin ne peut aller au-dessus de cette row
const ABSOLUTE_MIN_ROW = 3;

console.log("=== CONFIGURATION DE LA ZONE VISIBLE ===");
console.log(
  `Colonnes: ${minCol} à ${maxCol} (${maxCol - minCol + 1} colonnes)`
);
console.log(`Rows: ${minRow} à ${maxRow} (${maxRow - minRow + 1} rows)`);

// Position du chiffre "2" caché (au centre de la zone)
const secretCol = 15; // Centre horizontal: (5+25)/2 = 15
const secretRow = 8; // Centre vertical: (4+13)/2 = 8.5 ≈ 8

// Générer 4 positions aléatoires pour les chiffres
const symbols = ["6", "7", "8", "9"];
const symbolPositions = [];

// Stocker les chemins à afficher avec animation
const paths = [];

// Fonction pour vérifier si un carré est dans la zone
function isInConstraintZone(col, row) {
  // VÉRIFICATION ABSOLUE: ne jamais aller en dessous de ABSOLUTE_MIN_ROW
  if (row < ABSOLUTE_MIN_ROW) {
    return false;
  }
  return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
}

// Fonction pour calculer tous les carrés d'un chemin en L DANS LA ZONE DE CONTRAINTE
function calculatePathSquares(from, to) {
  const squares = [];

  // Chemin en L: vertical puis horizontal
  const startCol = from.col;
  const startRow = from.row;
  const endCol = to.col;
  const endRow = to.row;

  console.log(
    `Calcul du chemin de (${startCol},${startRow}) à (${endCol},${endRow})`
  );

  // Ajouter le carré de départ
  if (!isInConstraintZone(startCol, startRow)) {
    console.error(`❌ Carré de départ hors zone: (${startCol},${startRow})`);
    return null; // Retourner null si le départ est invalide
  }
  squares.push({ col: startCol, row: startRow });

  // Phase 1: Mouvement vertical (de startRow vers endRow)
  if (startRow !== endRow) {
    const verticalDirection = endRow > startRow ? 1 : -1;
    for (
      let r = startRow + verticalDirection;
      r !== endRow + verticalDirection;
      r += verticalDirection
    ) {
      // VÉRIFICATION ABSOLUE: ne JAMAIS aller au-dessus de ABSOLUTE_MIN_ROW
      if (r < ABSOLUTE_MIN_ROW) {
        console.error(
          `🚨 ALERTE CRITIQUE: Tentative d'aller en row ${r} (< ${ABSOLUTE_MIN_ROW}) - CHEMIN INVALIDE`
        );
        return null;
      }

      // VÉRIFICATION STRICTE: le carré doit être dans la zone
      if (!isInConstraintZone(startCol, r)) {
        console.error(
          `❌ Carré vertical hors zone: (${startCol},${r}) - CHEMIN INVALIDE`
        );
        return null; // Retourner null si un carré est hors zone
      }
      // Ne pas ajouter le carré final s'il sera ajouté par le mouvement horizontal
      if (r !== endRow || startCol === endCol) {
        squares.push({ col: startCol, row: r });
      }
    }
  }

  // Phase 2: Mouvement horizontal (de startCol vers endCol)
  if (startCol !== endCol) {
    const horizontalDirection = endCol > startCol ? 1 : -1;
    for (
      let c = startCol + horizontalDirection;
      c !== endCol + horizontalDirection;
      c += horizontalDirection
    ) {
      // VÉRIFICATION ABSOLUE: ne JAMAIS aller au-dessus de ABSOLUTE_MIN_ROW
      if (endRow < ABSOLUTE_MIN_ROW) {
        console.error(
          `🚨 ALERTE CRITIQUE: Tentative d'aller en row ${endRow} (< ${ABSOLUTE_MIN_ROW}) - CHEMIN INVALIDE`
        );
        return null;
      }

      // VÉRIFICATION STRICTE: le carré doit être dans la zone
      if (!isInConstraintZone(c, endRow)) {
        console.error(
          `❌ Carré horizontal hors zone: (${c},${endRow}) - CHEMIN INVALIDE`
        );
        return null; // Retourner null si un carré est hors zone
      }
      squares.push({ col: c, row: endRow });
    }
  }

  console.log(
    `✓ Chemin valide calculé avec ${squares.length} carrés (tous dans la zone)`
  );

  return squares;
}

// Fonction pour valider si un chemin entre deux positions est possible dans la zone
function isPathValid(from, to) {
  const testSquares = calculatePathSquares(from, to);
  return testSquares !== null && testSquares.length > 0;
}

// Fonction pour valider toutes les connexions possibles entre symboles
function validateAllPaths(positions) {
  console.log("=== VALIDATION DE TOUS LES CHEMINS POSSIBLES ===");

  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i];
    const to = positions[i + 1];

    if (!isPathValid(from, to)) {
      console.error(
        `❌ CHEMIN INVALIDE: ${from.symbol} (${from.col},${from.row}) → ${to.symbol} (${to.col},${to.row})`
      );
      return false;
    } else {
      console.log(
        `✓ Chemin valide: ${from.symbol} (${from.col},${from.row}) → ${to.symbol} (${to.col},${to.row})`
      );
    }
  }

  // Vérifier aussi le dernier symbole vers le "2"
  const lastSymbol = positions[positions.length - 1];
  if (!isPathValid(lastSymbol, { col: secretCol, row: secretRow })) {
    console.error(
      `❌ CHEMIN INVALIDE: ${lastSymbol.symbol} (${lastSymbol.col},${lastSymbol.row}) → 2 (${secretCol},${secretRow})`
    );
    return false;
  } else {
    console.log(
      `✓ Chemin valide: ${lastSymbol.symbol} (${lastSymbol.col},${lastSymbol.row}) → 2 (${secretCol},${secretRow})`
    );
  }

  console.log("✓ TOUS LES CHEMINS SONT VALIDES");
  return true;
}

// Fonction pour générer des positions aléatoires non-chevauchantes dans la zone définie
// AVEC VALIDATION DES CHEMINS
function generateSymbolPositions() {
  const maxGenerationAttempts = 100;
  let generationAttempt = 0;

  while (generationAttempt < maxGenerationAttempts) {
    generationAttempt++;
    console.log(`\n=== TENTATIVE DE GÉNÉRATION #${generationAttempt} ===`);

    // Réinitialiser les positions
    symbolPositions.length = 0;
    const positions = new Set();

    // Éviter la position du "2"
    positions.add(`${secretCol},${secretRow}`);

    let attempts = 0;
    const maxAttempts = 1000;

    // Générer 4 positions
    while (symbolPositions.length < 4 && attempts < maxAttempts) {
      attempts++;

      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
      const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));

      // VÉRIFICATION STRICTE
      if (!isInConstraintZone(col, row)) {
        console.error(
          `❌ ERREUR: (${col}, ${row}) hors zone [${minCol}-${maxCol}, ${minRow}-${maxRow}]`
        );
        continue;
      }

      const key = `${col},${row}`;

      if (!positions.has(key)) {
        symbolPositions.push({
          col,
          row,
          symbol: symbols[symbolPositions.length],
          found: false,
          order: -1,
        });
        positions.add(key);
        console.log(
          `✓ Chiffre ${
            symbols[symbolPositions.length - 1]
          } placé en (col:${col}, row:${row})`
        );
      }
    }

    if (symbolPositions.length < 4) {
      console.error(
        `ÉCHEC: Seulement ${symbolPositions.length}/4 symboles générés après ${attempts} tentatives`
      );
      continue;
    }

    // VALIDER TOUS LES CHEMINS
    if (validateAllPaths(symbolPositions)) {
      console.log("\n✅ GÉNÉRATION RÉUSSIE AVEC TOUS LES CHEMINS VALIDES\n");
      return true;
    } else {
      console.warn("⚠️ Chemins invalides, nouvelle tentative...");
    }
  }

  console.error(
    `❌ ÉCHEC APRÈS ${maxGenerationAttempts} TENTATIVES DE GÉNÉRATION`
  );
  return false;
}

generateSymbolPositions();

// Track last hovered square for audio
let lastHoveredSquare = null;
let lastHoveredCell = null;

// Track if the secret has been found
let secretFound = false;
let foundOrder = 0;
let finalPathCreated = false;

// Animation d'effacement des chemins
let erasingPaths = false;
let eraseTimer = 0;
const eraseInterval = 0.05; // Temps entre chaque carré effacé
let squaresToErase = []; // Liste de tous les carrés à effacer
let currentEraseIndex = 0;

// Système d'animation des chemins
let pathAnimationTimer = 0;
const pathAnimationInterval = 0.15; // 0.5 secondes par carré

// Fonction pour créer un chemin entre deux symboles avec animation
function createPath(from, to) {
  const squares = calculatePathSquares(from, to);

  // SÉCURITÉ: Ne créer le chemin QUE s'il est valide
  if (!squares || squares.length === 0) {
    console.error(
      `❌ IMPOSSIBLE DE CRÉER LE CHEMIN: (${from.col},${from.row}) → (${to.col},${to.row})`
    );
    return;
  }

  const path = {
    fromCol: from.col,
    fromRow: from.row,
    toCol: to.col,
    toRow: to.row,
    squares: squares,
    currentSquare: 0,
    complete: false,
  };

  paths.push(path);
  console.log(
    `✓ Chemin créé: (${from.col},${from.row}) → (${to.col},${to.row}) avec ${squares.length} carrés`
  );
}

// Fonction pour dessiner les chemins avec animation
function drawAnimatedPaths(startX, startY, cellSize, dt) {
  // Mettre à jour le timer
  pathAnimationTimer += dt;

  // Si le timer dépasse l'intervalle, avancer l'animation
  if (pathAnimationTimer >= pathAnimationInterval) {
    pathAnimationTimer = 0;

    // Avancer chaque chemin qui n'est pas complet
    paths.forEach((path) => {
      if (!path.complete && path.currentSquare < path.squares.length) {
        path.currentSquare++;
        if (path.currentSquare >= path.squares.length) {
          path.complete = true;
        }
      }
    });
  }

  // Dessiner tous les carrés visibles de chaque chemin
  paths.forEach((path) => {
    for (let i = 0; i < path.currentSquare; i++) {
      const square = path.squares[i];

      // Double vérification avant de dessiner (sécurité)
      if (isInConstraintZone(square.col, square.row)) {
        const x = startX + square.col * cellSize;
        const y = startY + square.row * cellSize;

        ctx.fillStyle = "white";
        ctx.fillRect(x, y, cellSize, cellSize);
      } else {
        console.error(
          `❌ TENTATIVE DE DESSINER UN CARRÉ HORS ZONE: (${square.col},${square.row})`
        );
      }
    }
  });
}

// Fonction pour préparer la liste des carrés à effacer
function prepareEraseSequence() {
  squaresToErase = [];

  // Collecter tous les carrés des chemins (dans l'ordre inverse)
  for (let i = paths.length - 1; i >= 0; i--) {
    const path = paths[i];
    for (let j = path.squares.length - 1; j >= 0; j--) {
      const square = path.squares[j];
      // Vérifier si ce carré n'est pas déjà dans la liste
      const exists = squaresToErase.some(
        (sq) => sq.col === square.col && sq.row === square.row
      );
      if (!exists) {
        squaresToErase.push(square);
      }
    }
  }

  // Ajouter aussi les positions des symboles trouvés
  symbolPositions.forEach((symb) => {
    if (symb.found) {
      const exists = squaresToErase.some(
        (sq) => sq.col === symb.col && sq.row === symb.row
      );
      if (!exists) {
        squaresToErase.push({ col: symb.col, row: symb.row });
      }
    }
  });

  console.log(
    `🗑️ ${squaresToErase.length} carrés à effacer (chemins + symboles)`
  );
  currentEraseIndex = 0;
}

function drawTwo(x, y, size) {
  const padding = size * 0.15;
  const innerSize = size - padding * 2;
  const startX = x + padding;
  const startY = y + padding;

  ctx.fillStyle = "black";
  ctx.font = `bold ${innerSize}px 'Tiny5', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("2", startX + innerSize / 2, startY + innerSize / 2);
}

function drawSymbol(symbol, x, y, size) {
  const padding = size * 0.15;
  const innerSize = size - padding * 2;
  const startX = x + padding;
  const startY = y + padding;

  ctx.fillStyle = "black";
  ctx.font = `bold ${innerSize}px 'Tiny5', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, startX + innerSize / 2, startY + innerSize / 2);
}

function allSymbolsFound() {
  return symbolPositions.every((s) => s.found);
}

function getNextSymbol() {
  return symbolPositions.find((s) => !s.found);
}

function getLastFoundSymbol() {
  let lastSymbol = null;
  let maxOrder = -1;

  symbolPositions.forEach((symb) => {
    if (symb.found && symb.order > maxOrder) {
      maxOrder = symb.order;
      lastSymbol = symb;
    }
  });

  return lastSymbol;
}

// Fonction pour vérifier si on peut trouver un symbole (doit être le prochain dans l'ordre)
function canFindSymbol(symbol) {
  // Le premier symbole (order -1) peut toujours être trouvé
  if (symbolPositions.filter((s) => s.found).length === 0) {
    return true;
  }

  // Pour les autres, vérifier que le symbole précédent a été trouvé
  const previousSymbol = symbolPositions.find((s) => !s.found && s !== symbol);

  // Si c'est le seul symbole restant non trouvé, on peut le trouver
  const notFoundSymbols = symbolPositions.filter((s) => !s.found);
  if (notFoundSymbols.length === 1 && notFoundSymbols[0] === symbol) {
    return true;
  }

  // Sinon, vérifier que c'est le premier dans l'ordre d'apparition
  const firstNotFound = symbolPositions.find((s) => !s.found);
  return symbol === firstNotFound;
}

function update(dt) {
  const cellSize = canvas.width / cols;
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = (canvas.width - gridWidth) / 2;
  const startY = (canvas.height - gridHeight) / 2;

  // Clear canvas (noir)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Si tous les symboles sont trouvés et qu'on n'a pas encore créé le chemin final
  if (allSymbolsFound() && !finalPathCreated) {
    const lastSymbol = getLastFoundSymbol();
    if (lastSymbol) {
      createPath(lastSymbol, { col: secretCol, row: secretRow });
      finalPathCreated = true;
    }
  }

  // Gestion de l'animation d'effacement
  if (erasingPaths) {
    eraseTimer += dt;

    if (eraseTimer >= eraseInterval) {
      eraseTimer = 0;
      currentEraseIndex++;

      // Si on a effacé tous les carrés, appeler finish()
      if (currentEraseIndex >= squaresToErase.length) {
        console.log("✨ Animation d'effacement terminée");
        finish();
        return;
      }
    }

    // Dessiner le 3x3 autour du "2"
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const col = secretCol + dx;
        const row = secretRow + dy;

        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          const x = startX + col * cellSize;
          const y = startY + row * cellSize;

          ctx.fillStyle = "white";
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }

    // Dessiner seulement les carrés qui ne sont pas encore effacés
    for (let i = currentEraseIndex; i < squaresToErase.length; i++) {
      const square = squaresToErase[i];
      const x = startX + square.col * cellSize;
      const y = startY + square.row * cellSize;

      ctx.fillStyle = "white";
      ctx.fillRect(x, y, cellSize, cellSize);
    }

    // Dessiner le "2" en noir
    const x = startX + secretCol * cellSize;
    const y = startY + secretRow * cellSize;
    drawTwo(x, y, cellSize);

    // Dessiner tous les symboles qui ne sont pas encore effacés
    symbolPositions.forEach((symb) => {
      if (symb.found) {
        // Vérifier si ce carré n'est pas encore effacé
        const symbErased = squaresToErase.some(
          (sq, idx) =>
            idx < currentEraseIndex &&
            sq.col === symb.col &&
            sq.row === symb.row
        );

        if (!symbErased) {
          const sx = startX + symb.col * cellSize;
          const sy = startY + symb.row * cellSize;
          drawSymbol(symb.symbol, sx, sy, cellSize);
        }
      }
    });

    // Dessiner les lignes de grille autour du 3x3
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    const leftX = startX + (secretCol - 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(leftX, startY);
    ctx.lineTo(leftX, startY + gridHeight);
    ctx.stroke();

    const rightX = startX + (secretCol + 2) * cellSize;
    ctx.beginPath();
    ctx.moveTo(rightX, startY);
    ctx.lineTo(rightX, startY + gridHeight);
    ctx.stroke();

    const topY = startY + (secretRow - 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    ctx.lineTo(startX + gridWidth, topY);
    ctx.stroke();

    const bottomY = startY + (secretRow + 2) * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    ctx.lineTo(startX + gridWidth, bottomY);
    ctx.stroke();

    return;
  }

  // Dessiner tous les chemins découverts avec animation (AVANT les symboles)
  drawAnimatedPaths(startX, startY, cellSize, dt);

  // Si le secret est trouvé, afficher un 3x3 centré sur le "2"
  if (secretFound) {
    // Zone 3x3 centrée sur le "2"
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const col = secretCol + dx;
        const row = secretRow + dy;

        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          const x = startX + col * cellSize;
          const y = startY + row * cellSize;

          ctx.fillStyle = "white";
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }

    // Dessiner tous les chiffres trouvés (carrés blancs)
    symbolPositions.forEach((symb) => {
      if (symb.found) {
        const sx = startX + symb.col * cellSize;
        const sy = startY + symb.row * cellSize;
        ctx.fillStyle = "white";
        ctx.fillRect(sx, sy, cellSize, cellSize);
      }
    });

    // Dessiner le chiffre "2" en noir au centre (APRÈS les carrés blancs)
    const x = startX + secretCol * cellSize;
    const y = startY + secretRow * cellSize;
    drawTwo(x, y, cellSize);

    // Dessiner tous les symboles en noir (APRÈS les carrés blancs)
    symbolPositions.forEach((symb) => {
      if (symb.found) {
        const sx = startX + symb.col * cellSize;
        const sy = startY + symb.row * cellSize;
        drawSymbol(symb.symbol, sx, sy, cellSize);
      }
    });

    // Dessiner les lignes de grille autour du 3x3
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    const leftX = startX + (secretCol - 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(leftX, startY);
    ctx.lineTo(leftX, startY + gridHeight);
    ctx.stroke();

    const rightX = startX + (secretCol + 2) * cellSize;
    ctx.beginPath();
    ctx.moveTo(rightX, startY);
    ctx.lineTo(rightX, startY + gridHeight);
    ctx.stroke();

    const topY = startY + (secretRow - 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    ctx.lineTo(startX + gridWidth, topY);
    ctx.stroke();

    const bottomY = startY + (secretRow + 2) * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    ctx.lineTo(startX + gridWidth, bottomY);
    ctx.stroke();

    // Démarrer l'animation d'effacement
    prepareEraseSequence();
    erasingPaths = true;

    return;
  }

  // Dessiner les symboles trouvés en permanence (carrés blancs)
  symbolPositions.forEach((symb) => {
    if (symb.found) {
      const sx = startX + symb.col * cellSize;
      const sy = startY + symb.row * cellSize;

      ctx.fillStyle = "white";
      ctx.fillRect(sx, sy, cellSize, cellSize);
    }
  });

  // Trouver la zone 3x3 centrée sur le carré le plus proche du curseur
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

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
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

  if (closestSquares.length > 0) {
    const squareKeys = closestSquares
      .map((sq) => `${sq.col},${sq.row}`)
      .sort()
      .join("|");

    if (squareKeys !== lastHoveredSquare) {
      let foundNewSymbol = false;
      let newlyFoundSymbol = null;

      symbolPositions.forEach((symb) => {
        if (!symb.found) {
          const isInZone = closestSquares.some(
            (sq) => sq.col === symb.col && sq.row === symb.row
          );

          // VÉRIFIER QUE C'EST LE PROCHAIN SYMBOLE À TROUVER
          if (isInZone && canFindSymbol(symb)) {
            symb.found = true;
            symb.order = foundOrder++;
            foundNewSymbol = true;
            newlyFoundSymbol = symb;
            console.log(
              `Chiffre ${symb.symbol} trouvé ! (${
                symbolPositions.filter((s) => s.found).length
              }/4)`
            );
          } else if (isInZone && !canFindSymbol(symb)) {
            console.log(
              `⚠️ Chiffre ${symb.symbol} détecté mais pas encore accessible (trouvez d'abord les précédents)`
            );
          }
        }
      });

      if (foundNewSymbol && newlyFoundSymbol) {
        const nextSymbol = getNextSymbol();
        if (nextSymbol) {
          createPath(newlyFoundSymbol, nextSymbol);
        }
      }

      const hasSecret = closestSquares.some(
        (sq) => sq.col === secretCol && sq.row === secretRow
      );

      if (hasSecret && allSymbolsFound()) {
        playSecret();
        secretFound = true;
        console.log("🎉 Tous les chiffres trouvés ! Le 2 est révélé !");
      } else if (foundNewSymbol) {
        playSecret();
      } else if (hasSecret) {
        playWhoosh();
      } else {
        playWhoosh();
      }
      lastHoveredSquare = squareKeys;
    }
  } else {
    lastHoveredSquare = null;
  }

  // Remplir les carrés de la zone 3x3
  closestSquares.forEach((sq) => {
    const x = startX + sq.col * cellSize;
    const y = startY + sq.row * cellSize;

    ctx.fillStyle = "white";
    ctx.fillRect(x, y, cellSize, cellSize);
  });

  // Dessiner les lignes de grille autour de la zone 3x3
  if (closestSquares.length > 0) {
    const minColGrid = Math.min(...closestSquares.map((sq) => sq.col));
    const maxColGrid = Math.max(...closestSquares.map((sq) => sq.col));
    const minRowGrid = Math.min(...closestSquares.map((sq) => sq.row));
    const maxRowGrid = Math.max(...closestSquares.map((sq) => sq.row));

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    const leftX = startX + minColGrid * cellSize;
    ctx.beginPath();
    ctx.moveTo(leftX, startY);
    ctx.lineTo(leftX, startY + gridHeight);
    ctx.stroke();

    const rightX = startX + (maxColGrid + 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(rightX, startY);
    ctx.lineTo(rightX, startY + gridHeight);
    ctx.stroke();

    const topY = startY + minRowGrid * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    ctx.lineTo(startX + gridWidth, topY);
    ctx.stroke();

    const bottomY = startY + (maxRowGrid + 1) * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    ctx.lineTo(startX + gridWidth, bottomY);
    ctx.stroke();
  }

  // IMPORTANT: Dessiner TOUS les symboles EN DERNIER pour qu'ils soient TOUJOURS en noir
  // Dessiner les symboles trouvés (après les carrés blancs)
  symbolPositions.forEach((symb) => {
    if (symb.found) {
      const sx = startX + symb.col * cellSize;
      const sy = startY + symb.row * cellSize;
      drawSymbol(symb.symbol, sx, sy, cellSize);
    }
  });

  // Dessiner UNIQUEMENT le prochain symbole à trouver dans la zone 3x3
  const nextToFind = symbolPositions.find((s) => !s.found);
  if (nextToFind) {
    const isInZone = closestSquares.some(
      (sq) => sq.col === nextToFind.col && sq.row === nextToFind.row
    );

    if (isInZone) {
      const sx = startX + nextToFind.col * cellSize;
      const sy = startY + nextToFind.row * cellSize;
      drawSymbol(nextToFind.symbol, sx, sy, cellSize);
    }
  }

  // Dessiner le chiffre "2" en noir si tous les chiffres sont trouvés ET qu'il est dans la zone
  if (allSymbolsFound()) {
    const isInZone = closestSquares.some(
      (sq) => sq.col === secretCol && sq.row === secretRow
    );

    if (isInZone) {
      const secretX = startX + secretCol * cellSize;
      const secretY = startY + secretRow * cellSize;
      drawTwo(secretX, secretY, cellSize);
    }
  }
}
