import {
  getLineSignature,
  isProtectedPoint,
  isProhibitedConnection,
  isSpecificPathDrawn,
  isSpecialConnection,
} from "./utils.js";
import { INSIDE_CONNECTIONS } from "./constants.js";

export class GameLogic {
  constructor(gameState, points, finish) {
    this.gameState = gameState;
    this.points = points;
    this.finish = finish;
  }

  updatePoints(points) {
    this.points = points;
  }

  triggerPathCompletion() {
    if (this.gameState.pathCompleted) return;

    this.gameState.pathCompleted = true;
    console.log("FIN ???");

    // Make all non-protected points fall
    for (const p of this.points) {
      if (!isProtectedPoint(p) && !p.isFalling && !p.hasLanded) {
        p.isFalling = true;
        p.velocityX = (Math.random() - 0.5) * 8;
        p.velocityY = 0;
      }
    }

    // Add the INSIDE_CONNECTIONS to the current lines using addLine (handles duplicates/prohibited logic)
    for (const conn of INSIDE_CONNECTIONS) {
      const [a, b] = conn;
      const p1 = this.points.find((pt) => pt.row === a.row && pt.col === a.col);
      const p2 = this.points.find((pt) => pt.row === b.row && pt.col === b.col);
      if (p1 && p2) {
        this.addLine(p1, p2);
      }
    }

    // Wait for fill animation (time for renderer to draw the new lines)
    const FILL_DELAY = 1500;
    setTimeout(() => {
      console.log(
        "Shape filled (INSIDE_CONNECTIONS drawn), starting fade to black..."
      );

      // Trigger a fade flag that the renderer can use to draw a full-screen fade to black.
      // Also provide metadata (duration/start) so the renderer can animate smoothly.
      this.gameState.fadeAll = true;
      this.gameState.fadeDuration = 1000; // ms
      this.gameState.fadeStart = performance.now();

      // Give the renderer time to complete fade, then call finish()
      setTimeout(() => {
        console.log("Everything faded, calling finish()...");
        this.finish();
      }, this.gameState.fadeDuration + 100); // small buffer
    }, FILL_DELAY);
  }

  addLine(p1, p2) {
    if (!p1 || !p2 || p1 === p2) return;

    // Check for duplicates using the Set
    const signature = getLineSignature(p1, p2);
    if (this.gameState.drawnLines.has(signature)) {
      return;
    }

    // Check if this is a prohibited connection
    if (isProhibitedConnection(p1, p2)) {
      return;
    }

    const special = isSpecialConnection(p1, p2);
    if (special) {
      this.gameState.lines.push({ start: p1, end: p2, special });
      this.gameState.drawnLines.add(signature);
      // Keep locked point for next connection
      // Check if the specific path is now complete
      if (isSpecificPathDrawn(this.gameState.drawnLines)) {
        console.log("🎉 Complete path has been drawn!");
        this.triggerPathCompletion();
      }
    } else {
      // Only make p1 fall if it's not a protected point
      if (!isProtectedPoint(p1) && !p1.isFalling) {
        p1.isFalling = true;
        p1.velocityX = (Math.random() - 0.5) * 5;
        p1.velocityY = 0;
      }

      // Only make p2 fall if it's not a protected point
      if (!isProtectedPoint(p2) && !p2.isFalling) {
        p2.isFalling = true;
        p2.velocityX = (Math.random() - 0.5) * 5;
        p2.velocityY = 0;
      }

      // Unlock point after invalid connection
      this.gameState.lockedPoint = null;
    }
  }
}
