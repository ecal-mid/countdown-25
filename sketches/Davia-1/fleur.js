export default class Fleur {
  constructor(x, y, height, canvasHeight) {
    this.x = x;
    this.targetY = y; // Store the target position
    this.y = canvasHeight + height; // Start below the screen
    this.height = height;
    this.width = (852.5 / 912.1) * height;

    // Load all the layer SVGs
    this.fleur = new Image();
    this.fleur.src = "fleur.svg";
    this.fleurLoaded = false;

    this.stem = new Image();
    this.stem.src = "1.svg";
    this.stemLoaded = false;

    this.leftLeaf = new Image();
    this.leftLeaf.src = "fgauche.svg";
    this.leftLeafLoaded = false;

    this.rightLeaf = new Image();
    this.rightLeaf.src = "fdroite.svg";
    this.rightLeafLoaded = false;

    // Load the final complete flower
    this.finalFlower = new Image();
    this.finalFlower.src = "final1.svg";
    this.finalFlowerLoaded = false;

    // Load zone SVGs for detection
    this.zoneFleur = new Image();
    this.zoneFleur.src = "zonefleur.svg";
    this.zoneFleurLoaded = false;

    this.zoneLeftLeaf = new Image();
    this.zoneLeftLeaf.src = "zonegauche.svg";
    this.zoneLeftLeafLoaded = false;

    this.zoneRightLeaf = new Image();
    this.zoneRightLeaf.src = "zonedroite.svg";
    this.zoneRightLeafLoaded = false;

    // Use final1.svg as detection zone for stem
    this.zoneStem = new Image();
    this.zoneStem.src = "final1.svg";
    this.zoneStemLoaded = false;

    // Create offscreen canvases for zone detection
    this.zoneCanvas = document.createElement("canvas");
    this.zoneCtx = this.zoneCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.fleur.onload = () => {
      this.fleurLoaded = true;
    };

    this.stem.onload = () => {
      this.stemLoaded = true;
    };

    this.leftLeaf.onload = () => {
      this.leftLeafLoaded = true;
    };

    this.rightLeaf.onload = () => {
      this.rightLeafLoaded = true;
    };

    this.finalFlower.onload = () => {
      this.finalFlowerLoaded = true;
    };

    this.zoneFleur.onload = () => {
      this.zoneFleurLoaded = true;
    };

    this.zoneLeftLeaf.onload = () => {
      this.zoneLeftLeafLoaded = true;
    };

    this.zoneRightLeaf.onload = () => {
      this.zoneRightLeafLoaded = true;
    };

    this.zoneStem.onload = () => {
      this.zoneStemLoaded = true;
    };

    // Individual layer transformations
    this.fleurOffset = { x: 0, y: 0 };
    this.stemOffset = { x: 0, y: 0 };
    this.leftLeafOffset = { x: 0, y: 0 };
    this.rightLeafOffset = { x: 0, y: 0 };

    this.fleurRotation = 0;
    this.stemRotation = 0;
    this.leftLeafRotation = 0;
    this.rightLeafRotation = 0;

    this.fleurScale = 1;
    this.stemScale = 1;
    this.leftLeafScale = 1;
    this.rightLeafScale = 1;

    // Detachment and falling physics
    this.fleurDetached = false;
    this.leftLeafDetached = false;
    this.rightLeafDetached = false;

    this.fleurVelocity = { x: 0, y: 0 };
    this.leftLeafVelocity = { x: 0, y: 0 };
    this.rightLeafVelocity = { x: 0, y: 0 };

    this.fleurAngularVelocity = 0;
    this.leftLeafAngularVelocity = 0;
    this.rightLeafAngularVelocity = 0;

    // Physics constants
    this.gravity = 0.3;
    this.angularDamping = 0.98;

    // Animation states
    this.rising = true;
    this.riseSpeed = 0;
    this.gardeningComplete = false;
    this.stemCentering = false;
    this.stemCentered = false;
    this.finalFlowerAppearing = false;
    this.finalFlowerOpacity = 0;
    this.finalFlowerVisible = false;
    this.finalDelay = 0;
    this.finalFalling = false;
    this.finalFallVelocity = 0;
    this.finalFallRotation = 0;
    this.finalFallRotationSpeed = 0;

    // Store target position
    this.targetCenterY = 0;
    this.centeringSpeed = 0;
    this.centeringDelay = 0;
    this.fadeInSpeed = 0.02;

    // Stem flicker effect
    this.stemFlickering = false;
    this.stemFlickerCount = 0;
    this.stemFlickerFrame = 0;
    this.stemShowRed = false;

    // Calculate rise speed
    this.riseSpeed = (this.y - this.targetY) / 90; // 90 frames to rise
  }

  get loaded() {
    return (
      this.fleurLoaded &&
      this.stemLoaded &&
      this.leftLeafLoaded &&
      this.rightLeafLoaded &&
      this.zoneFleurLoaded &&
      this.zoneLeftLeafLoaded &&
      this.zoneRightLeafLoaded &&
      this.zoneStemLoaded
    );
  }

  // Check if all detachable parts have fallen off screen
  checkIfAllFallen(canvasHeight) {
    if (
      !this.fleurDetached ||
      !this.leftLeafDetached ||
      !this.rightLeafDetached
    ) {
      return false;
    }

    const threshold = canvasHeight + 500;

    const fleurOffScreen = this.y + this.fleurOffset.y > threshold;
    const leftLeafOffScreen = this.y + this.leftLeafOffset.y > threshold;
    const rightLeafOffScreen = this.y + this.rightLeafOffset.y > threshold;

    return fleurOffScreen && leftLeafOffScreen && rightLeafOffScreen;
  }

  // Start the centering animation
  startCentering(canvasHeight, size) {
    if (!this.gardeningComplete) {
      this.gardeningComplete = true;
      this.stemCentering = true;
      this.targetCenterY = canvasHeight / 2 - (canvasHeight - size) / 2;
      this.centeringSpeed = (this.targetCenterY - this.y) / 60;
      console.log("Gardening complete! Centering stem...");
    }
  }

  // Check if a point is inside a zone using pixel detection
  isPointInZone(px, py, zoneImage) {
    // Transform point to local coordinates
    const localX = px - this.x;
    const localY = py - this.y;

    // Set up the zone canvas to match the flower dimensions
    this.zoneCanvas.width = this.width;
    this.zoneCanvas.height = this.height;

    // Clear and draw the zone image
    this.zoneCtx.clearRect(0, 0, this.width, this.height);
    this.zoneCtx.drawImage(zoneImage, 0, 0, this.width, this.height);

    // Convert local coordinates to zone canvas coordinates
    const canvasX = localX + this.width / 2;
    const canvasY = localY + this.height / 2;

    // Check if coordinates are within canvas bounds
    if (
      canvasX < 0 ||
      canvasX >= this.width ||
      canvasY < 0 ||
      canvasY >= this.height
    ) {
      return false;
    }

    // Get pixel data at the point
    const pixelData = this.zoneCtx.getImageData(canvasX, canvasY, 1, 1).data;

    // Check if pixel has any opacity (alpha > 0)
    return pixelData[3] > 0;
  }

  // Check if a point is inside a layer's zone
  isPointInLayer(px, py, layerName) {
    if (!this.loaded) return false;

    let zoneImage;
    if (layerName === "fleur") zoneImage = this.zoneFleur;
    else if (layerName === "leftLeaf") zoneImage = this.zoneLeftLeaf;
    else if (layerName === "rightLeaf") zoneImage = this.zoneRightLeaf;
    else if (layerName === "stem") zoneImage = this.zoneStem;
    else return false;

    return this.isPointInZone(px, py, zoneImage);
  }

  // Check if a line segment crosses through a layer
  checkSlice(startX, startY, endX, endY) {
    const layers = ["fleur", "leftLeaf", "rightLeaf", "stem"];

    for (let layer of layers) {
      const numSamples = 20;
      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;

        if (this.isPointInLayer(x, y, layer)) {
          this.detachLayer(layer, endX - startX, endY - startY);
          return true;
        }
      }
    }
    return false;
  }

  // Detach a layer and give it initial velocity based on slice direction
  detachLayer(layerName, sliceVelocityX, sliceVelocityY, ctx) {
    if (layerName === "fleur" && !this.fleurDetached) {
      this.fleurDetached = true;
      this.fleurVelocity = {
        x: sliceVelocityX * 0.05,
        y: sliceVelocityY * 0.05,
      };
      this.fleurAngularVelocity = (Math.random() - 0.5) * 0.15;
      console.log("Fleur detached!");
    } else if (layerName === "leftLeaf" && !this.leftLeafDetached) {
      this.leftLeafDetached = true;
      this.leftLeafVelocity = {
        x: sliceVelocityX * 0.05,
        y: sliceVelocityY * 0.05,
      };
      this.leftLeafAngularVelocity = (Math.random() - 0.5) * 0.15;
      console.log("Left leaf detached!");
    } else if (layerName === "rightLeaf" && !this.rightLeafDetached) {
      this.rightLeafDetached = true;
      this.rightLeafVelocity = {
        x: sliceVelocityX * 0.05,
        y: sliceVelocityY * 0.05,
      };
      this.rightLeafAngularVelocity = (Math.random() - 0.5) * 0.15;
      console.log("Right leaf detached!");
    } else if (layerName === "stem" && !this.stemFlickering) {
      // Start flicker effect for stem
      this.stemFlickering = true;
      this.stemFlickerCount = 0;
      this.stemFlickerFrame = 0;
      this.stemShowRed = false;
      console.log("Stem clicked! Flickering...");
    }
  }

  // Update physics for detached layers
  update(canvasHeight) {
    // Initial rise animation
    if (this.rising) {
      this.y -= this.riseSpeed;

      if (this.y <= this.targetY) {
        this.y = this.targetY;
        this.rising = false;
        console.log("Plant fully risen!");
      }
      return; // Don't process other updates while rising
    }

    // Handle stem flicker animation
    if (this.stemFlickering) {
      this.stemFlickerFrame++;

      // Toggle red filter every 5 frames (adjust for speed)
      if (this.stemFlickerFrame % 12 === 0) {
        this.stemShowRed = !this.stemShowRed;

        // Count complete flickers (on + off = 1 flicker)
        if (!this.stemShowRed) {
          this.stemFlickerCount++;
        }

        // Stop after 2 complete flickers
        if (this.stemFlickerCount >= 2) {
          this.stemFlickering = false;
          this.stemShowRed = false;
          console.log("Stem flicker complete!");
        }
      }
    }

    // Update falling physics for detached parts
    if (this.fleurDetached) {
      this.fleurVelocity.y += this.gravity;
      this.fleurOffset.x += this.fleurVelocity.x;
      this.fleurOffset.y += this.fleurVelocity.y;
      this.fleurRotation += this.fleurAngularVelocity;
      this.fleurAngularVelocity *= this.angularDamping;
    }

    if (this.leftLeafDetached) {
      this.leftLeafVelocity.y += this.gravity;
      this.leftLeafOffset.x += this.leftLeafVelocity.x;
      this.leftLeafOffset.y += this.leftLeafVelocity.y;
      this.leftLeafRotation += this.leftLeafAngularVelocity;
      this.leftLeafAngularVelocity *= this.angularDamping;
    }

    if (this.rightLeafDetached) {
      this.rightLeafVelocity.y += this.gravity;
      this.rightLeafOffset.x += this.rightLeafVelocity.x;
      this.rightLeafOffset.y += this.rightLeafVelocity.y;
      this.rightLeafRotation += this.rightLeafAngularVelocity;
      this.rightLeafAngularVelocity *= this.angularDamping;
    }

    // Check if all parts have fallen
    if (!this.gardeningComplete && this.checkIfAllFallen(canvasHeight)) {
      this.startCentering(canvasHeight, this.height * 0.9);
    }

    // Animate stem centering
    if (this.stemCentering && !this.stemCentered) {
      this.stemFlickering = false;
      this.y += this.centeringSpeed;

      if (
        Math.abs(this.y - this.targetCenterY) < Math.abs(this.centeringSpeed)
      ) {
        this.y = this.targetCenterY;
        this.stemCentered = true;
        this.centeringDelay = 30;
        console.log("Stem centered! Starting delay...");
      }
    }

    // Handle delay before final flower appears
    if (this.stemCentered && this.centeringDelay > 0) {
      this.stemFlickering = false;
      this.centeringDelay--;
      if (this.centeringDelay === 0) {
        this.finalFlowerAppearing = true;
        console.log("Final flower appearing!");
      }
    }

    // Fade in final flower
    if (this.finalFlowerAppearing && this.finalFlowerOpacity < 1) {
      this.stemFlickering = false;
      this.finalFlowerOpacity += this.fadeInSpeed;
      if (this.finalFlowerOpacity >= 1) {
        this.finalFlowerOpacity = 1;
        this.finalFlowerVisible = true;
        this.finalDelay = 90; // 1 second delay at 60fps
        console.log("Final flower fully visible! Starting final delay...");
      }
    }

    // Handle delay before final fall
    if (this.finalFlowerVisible && this.finalDelay > 0) {
      this.finalDelay--;
      if (this.finalDelay === 0) {
        this.finalFalling = true;
        this.finalFallRotationSpeed = (Math.random() - 0.5) * 0.1;
        console.log("Final flower falling!");
      }
    }

    // Final falling animation
    if (this.finalFalling) {
      this.finalFallVelocity += this.gravity * 1.5; // Fall faster
      this.y += this.finalFallVelocity;
      this.finalFallRotation += this.finalFallRotationSpeed;
    }
  }

  drawLayer(ctx, image, offset, rotation, scale, applyRedFilter = false) {
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // Apply red filter if requested
    if (applyRedFilter) {
      ctx.filter =
        "hue-rotate(0deg) saturate(100) brightness(0.2) sepia(2) hue-rotate(-50deg) saturate(10)";
    }

    ctx.drawImage(
      image,
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height
    );
    ctx.restore();
  }

  draw(ctx) {
    if (this.loaded) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Apply final fall rotation to everything
      if (this.finalFalling) {
        ctx.rotate(this.finalFallRotation);
      }

      // Always draw the stem (1.svg) with flicker effect
      if (this.stemLoaded) {
        this.drawLayer(
          ctx,
          this.stem,
          this.stemOffset,
          this.stemRotation,
          this.stemScale,
          this.stemShowRed
        );
      }

      // Draw detachable layers only if not fallen
      if (this.leftLeafLoaded && !this.gardeningComplete) {
        this.drawLayer(
          ctx,
          this.leftLeaf,
          this.leftLeafOffset,
          this.leftLeafRotation,
          this.leftLeafScale,
          this.leftLeafDetached
        );
      }

      if (this.rightLeafLoaded && !this.gardeningComplete) {
        this.drawLayer(
          ctx,
          this.rightLeaf,
          this.rightLeafOffset,
          this.rightLeafRotation,
          this.rightLeafScale,
          this.rightLeafDetached
        );
      }

      if (this.fleurLoaded && !this.gardeningComplete) {
        this.drawLayer(
          ctx,
          this.fleur,
          this.fleurOffset,
          this.fleurRotation,
          this.fleurScale,
          this.fleurDetached
        );
      }

      // Draw final flower (final1.svg) with fade-in effect on top of stem
      if (this.finalFlowerAppearing && this.finalFlowerLoaded) {
        ctx.save();
        ctx.globalAlpha = this.finalFlowerOpacity;
        ctx.drawImage(
          this.finalFlower,
          -this.width / 2,
          -this.height / 2,
          this.width,
          this.height
        );
        ctx.restore();
      }

      ctx.restore();
    }
  }
}
