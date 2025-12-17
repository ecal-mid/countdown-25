export default class DrawingManager {
  constructor(totalPathDistance, canvas) {
    this.totalPathDistance = totalPathDistance;
    this.canvas = canvas;

    // Drawing zone definitions - as percentages (0 to 1)
    this.DRAW_ZONE_START_PERCENT = 0.275;
    this.DRAW_ZONE_END_PERCENT = 0.4351;
    this.DRAW_ZONE_2_START_PERCENT = 0.5605;
    this.DRAW_ZONE_2_END_PERCENT = 0.625;

    // Tolerance for zone completion (in pixels)
    this.COMPLETION_TOLERANCE = 10;

    // Drawing zones
    this.drawingZones = [
      {
        start: this.DRAW_ZONE_START_PERCENT,
        end: this.DRAW_ZONE_END_PERCENT,
        maxDrawn: 0,
      },
      {
        start: this.DRAW_ZONE_2_START_PERCENT,
        end: this.DRAW_ZONE_2_END_PERCENT,
        maxDrawn: 0,
      },
    ];

    // Undrawing state
    this.isUndrawing = false;
    this.undrawDelay = 1000; // 1 second delay before undrawing starts
    this.undrawStartTime = 0;
    this.currentUndrawZone = 0; // Which zone is currently being undrawn
    this.undrawProgress = 0;
    this.UNDRAW_SPEED = 15; // Pixels per frame to undraw
    this.allUndrawn = false; // Flag to track if everything is undrawn
  }

  // Update the total path distance
  setTotalPathDistance(distance) {
    this.totalPathDistance = distance;
  }

  // Get which zone (if any) a distance is in
  getCurrentZone(distance) {
    if (this.totalPathDistance === 0) return null;

    for (let i = 0; i < this.drawingZones.length; i++) {
      const zone = this.drawingZones[i];
      const startDistance = this.totalPathDistance * zone.start;
      const endDistance = this.totalPathDistance * zone.end;

      if (distance >= startDistance && distance <= endDistance) {
        return { index: i, startDistance, endDistance };
      }
    }
    return null;
  }

  // Update drawing progress for a zone
  updateZoneProgress(distance, speed) {
    const currentZone = this.getCurrentZone(distance);
    if (currentZone && speed > 0.1) {
      const zone = this.drawingZones[currentZone.index];
      zone.maxDrawn = Math.max(zone.maxDrawn, distance);
    }
  }

  // Check if all zones are fully drawn
  areAllZonesFullyDrawn() {
    if (this.totalPathDistance === 0) return false;

    return this.drawingZones.every((zone) => {
      const endDistance = this.totalPathDistance * zone.end;
      return zone.maxDrawn >= endDistance - this.COMPLETION_TOLERANCE;
    });
  }

  // Check if everything has been undrawn
  isEverythingUndrawn() {
    return this.allUndrawn;
  }

  // Start the undrawing sequence
  startUndrawing() {
    if (!this.isUndrawing && this.undrawStartTime === 0) {
      this.undrawStartTime = Date.now();
    }
  }

  // Update undrawing animation
  updateUndraw() {
    // Check if we should start undrawing
    if (this.undrawStartTime > 0 && !this.isUndrawing) {
      const timeSinceFade = Date.now() - this.undrawStartTime;
      if (timeSinceFade >= this.undrawDelay) {
        this.isUndrawing = true;
        console.log("Starting undraw animation");
      }
    }

    // Update undraw progress
    if (this.isUndrawing && !this.allUndrawn) {
      this.undrawProgress += this.UNDRAW_SPEED;

      // Check if current zone is completely undrawn
      const currentZone = this.drawingZones[this.currentUndrawZone];
      if (currentZone) {
        const zoneStartDistance = this.totalPathDistance * currentZone.start;
        const zoneEndDistance = this.totalPathDistance * currentZone.end;
        const zoneLength = zoneEndDistance - zoneStartDistance;

        // If we've undrawn the entire current zone, move to next zone
        if (this.undrawProgress >= zoneLength) {
          this.currentUndrawZone++;
          this.undrawProgress = 0;

          //   console.log(
          //     `Zone ${this.currentUndrawZone} undrawn. Total zones: ${this.drawingZones.length}`
          //   );

          // Check if all zones are undrawn
          if (this.currentUndrawZone >= this.drawingZones.length) {
            this.allUndrawn = true;
            // console.log("All zones marked as undrawn in DrawingManager");
          }
        }
      }
    }
  }

  // Draw all the white lines with undrawing effect
  draw(ctx, path) {
    if (!path.loaded || this.totalPathDistance === 0) return;

    ctx.save();
    ctx.strokeStyle = "white";
    ctx.lineWidth = this.canvas.width / 25;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    this.drawingZones.forEach((zone, zoneIndex) => {
      const startDistance = this.totalPathDistance * zone.start;
      let endDistance = Math.min(
        zone.maxDrawn,
        this.totalPathDistance * zone.end
      );

      // Skip zones that haven't been drawn yet
      if (endDistance <= startDistance) return;

      // Handle undrawing
      if (this.isUndrawing) {
        // Zones before current undraw zone are completely undrawn - skip them
        if (zoneIndex < this.currentUndrawZone) {
          return;
        }

        // Current zone being undrawn
        if (zoneIndex === this.currentUndrawZone) {
          const undrawStart = startDistance + this.undrawProgress;

          // Zone completely undrawn
          if (undrawStart >= endDistance) {
            return;
          }

          // Draw remaining portion of zone
          ctx.beginPath();
          const undrawPoint = path.getPointAtDistance(undrawStart);
          if (!undrawPoint) return;

          ctx.moveTo(undrawPoint.x, undrawPoint.y);

          const step = 10;
          for (let d = undrawStart + step; d <= endDistance; d += step) {
            const point = path.getPointAtDistance(d);
            if (point) {
              ctx.lineTo(point.x, point.y);
            }
          }

          const finalPoint = path.getPointAtDistance(endDistance);
          if (finalPoint) {
            ctx.lineTo(finalPoint.x, finalPoint.y);
          }

          ctx.stroke();
          return;
        }

        // Zones after current undraw zone - draw normally (not undrawn yet)
      }

      // Normal drawing (when not undrawing or zone hasn't been reached for undrawing)
      ctx.beginPath();

      const startPoint = path.getPointAtDistance(startDistance);
      if (startPoint) {
        ctx.moveTo(startPoint.x, startPoint.y);

        const step = 10;
        for (let d = startDistance + step; d <= endDistance; d += step) {
          const point = path.getPointAtDistance(d);
          if (point) {
            ctx.lineTo(point.x, point.y);
          }
        }

        const finalPoint = path.getPointAtDistance(endDistance);
        if (finalPoint) {
          ctx.lineTo(finalPoint.x, finalPoint.y);
        }

        ctx.stroke();
      }
    });

    ctx.restore();
  }
}
