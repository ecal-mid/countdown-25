import { createEngine } from "../_shared/engine.js"
import { NoisyEllipseMask } from "./noisyEllipseMask.js"

const { renderer, input, math, run, finish } = createEngine()
const { ctx, canvas } = renderer

let images = []
let currentFrameIndex = 0
let dragStartY = null
let wasDragging = false
// Drag sensitivity: controls how much distance is needed to cycle through all frames
const DRAG_SENSITIVITY = 1.8
// Image scale: controls the size of all images (1.0 = original size, 0.5 = half size, 2.0 = double size)
const IMAGE_SCALE = .5

// Mask closing variables
let delayStarted = false
let delayTimer = 0
const DELAY_DURATION = 3.0 // 3 seconds delay after reaching final image
let maskClosing = false
let finalStateReached = false // Track if we've reached the final state (locked to last image)

// Create mask instance with configuration
const mask = new NoisyEllipseMask(canvas, input, {
  margin: 40,
  ellipseVertices: 320,
  noiseStrength: 50,
  noiseSpeed: 2.0,
  noiseDistance: 15.0,
  springFrequency: 1,
  springHalfLife: 0.1
})

// Load all images from the images folder
async function loadImages() {
  const imageCount = 16
  images = []

  for (let i = 1; i <= imageCount; i++) {
    const img = new Image()
    img.src = `images/new-frames/new-frames-eyes/M_${99 + i}.png`
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    images.push(img)
  }
}

// Initialize and start the loop
loadImages().then(() => {
  run(update)
})

function update(dt) {
  // Update mask animation
  mask.update(dt)

  // Get current Y position relative to canvas
  const canvasRect = canvas.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio
  const mouseY = input.getY() - canvasRect.top * pixelRatio

  // Handle drag start
  if (input.isDown() && !finalStateReached) {
    // Reset to frame 1 and start tracking drag
    dragStartY = mouseY
    wasDragging = false
    currentFrameIndex = 0 // Start at frame 1 when clicking
    // Reset delay if user starts dragging again
    delayStarted = false
    delayTimer = 0
    maskClosing = false
  }

  // Handle dragging (only if not in final state)
  if (input.isPressed() && images.length > 0 && dragStartY !== null && !finalStateReached) {
    // Calculate relative movement from drag start
    const dragDelta = mouseY - dragStartY

    // Check if mouse has moved (actually dragging)
    if (Math.abs(dragDelta) > 2) { // Small threshold to detect actual movement
      wasDragging = true
    }

    if (wasDragging) {
      // Map relative drag movement to frame index
      // Drag down (positive delta) = higher frame numbers
      // Drag up (negative delta) = lower frame numbers
      // Apply sensitivity: divide by sensitivity to control how much distance is needed
      const normalizedDelta = (dragDelta / canvas.height) * DRAG_SENSITIVITY
      // Map to frame index: start at 0, progress through all frames
      const frameOffset = Math.round(normalizedDelta * (images.length - 1))
      currentFrameIndex = Math.max(0, Math.min(images.length - 1, frameOffset))
    }
  }

  // Handle drag end
  if (input.isUp()) {
    dragStartY = null
    wasDragging = false
    // If we're at the last image, keep it to indicate end of sequence
    // Otherwise reset to frame 1 when releasing
    if (currentFrameIndex !== images.length - 1) {
      currentFrameIndex = 0
      // Reset delay if not at final image
      delayStarted = false
      delayTimer = 0
      maskClosing = false
      finalStateReached = false
    } else if (currentFrameIndex === images.length - 1 && !finalStateReached) {
      // Lock to final image when we reach it and start the delay timer
      finalStateReached = true
      currentFrameIndex = images.length - 1 // Ensure we're at the last frame
      delayStarted = true
      delayTimer = 0
    }
  }

  // Update delay timer
  if (delayStarted && !maskClosing) {
    delayTimer += dt
    // After delay duration, start closing the mask with animation
    if (delayTimer >= DELAY_DURATION) {
      maskClosing = true
      mask.setExpanded(false) // Start closing animation
    }
  }

  // Apply mask and draw content inside
  mask.applyMask(ctx, () => {
    // Draw the current frame centered
    // In final state, always show the last image
    const frameToShow = finalStateReached ? images.length - 1 : currentFrameIndex
    if (images.length > 0 && images[frameToShow]) {
      const img = images[frameToShow]
      const scaledWidth = img.width * IMAGE_SCALE
      const scaledHeight = img.height * IMAGE_SCALE
      const x = (canvas.width - scaledWidth) / 2
      const y = (canvas.height - scaledHeight) / 2
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
    }
  })

  // Finish sequence when mask is fully closed (check mask spring position)
  if (maskClosing) {
    // Check if mask spring has reached 0 (fully closed)
    const maskRadius = mask.spring.position
    if (maskRadius <= 1) { // Use small threshold for floating point comparison
      finish()
    }
  }
}

