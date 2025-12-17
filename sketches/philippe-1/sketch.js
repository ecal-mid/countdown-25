import { createEngine } from "../_shared/engine.js"
import { NoisyEllipseMask } from "./noisyEllipseMask.js"
import { Iris } from "./iris.js"
import { EyeballMask } from "./eyeballMask.js"
import { Rectangle } from "./rectangle.js"

const { renderer, input, run, finish } = createEngine()
const { ctx, canvas } = renderer

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

let irises = []
let eyeballMasks = []
let SleepingEyeBall = {
  images: []
}
let animatedEyeBall = {
  images: []
}
let closedMouth = {
  images: []
}
let openedMouth = {
  images: []
}
let rectangle = null
const EYE_COUNT = 5
const irisSize = 150
const eyeballMaskSize = 200
const animatedEyeBallScale = 1.30  // Scale factor for animatedEyeBall image
const closedMouthScale = 0.5  // Scale factor for closed mouth image
const openedMouthScale = 0.5  // Scale factor for opened mouth image
let SEED = 6264  // Change this value to get different arrangements
let visibleEyeCount = 1  // Start with only one eye visible
let eyesClicked = new Set()  // Track which eyes have been clicked
let eyesActivated = new Set()  // Track which eyes have been activated (switched from SVG to eyeballMask)
let showRectangle = false  // Flag to show rectangle when last eye is clicked
let showRedRectangle = false  // Flag to show red rectangle
let rectangleClicked = false  // Track if rectangle has been clicked
let redRectangleStartTime = null  // Time when red rectangle appeared

// Mask closing variables
let delayStarted = false
let delayTimer = 0
const DELAY_DURATION = 3.0 // 3 seconds delay after rectangle turns back to black
let maskClosing = false
let rectangleTurnedBlack = false  // Track when rectangle has turned back to black

// Seeded random number generator
function createSeededRandom(seed) {
  let value = seed
  return function () {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Generate eye positions in an arch above the rectangle (mouth) in the top half (0 to height/2)
function generateEyesAroundRectangle(rectX, rectY, rectWidth, rectHeight, eyeCount, eyeSize, random) {
  const eyePositions = []

  // Calculate base radius - distance from rectangle edge to place eyes
  // Use the larger dimension of the rectangle plus padding
  const rectMaxDimension = Math.max(rectWidth, rectHeight)
  const baseRadius = rectMaxDimension / 2 + eyeSize * 1.5

  // Create an arch above the rectangle - angles from -PI to 0 (top half circle, negative sin)
  // Distribute eyes evenly across the arch
  const startAngle = -Math.PI  // Left side of arch (top)
  const endAngle = 0           // Right side of arch (top)
  const angleRange = endAngle - startAngle
  const angleStep = angleRange / (eyeCount - 1) // Distribute across arch

  // Generate positions in an arch above the rectangle
  for (let i = 0; i < eyeCount; i++) {
    // Base angle with some variation from seed
    const baseAngle = startAngle + i * angleStep
    const angleVariation = (random() - 0.5) * 0.2 // ±10% variation
    const angle = baseAngle + angleVariation

    // Radius with some variation
    const radiusVariation = (random() - 0.5) * eyeSize * 0.4 // ±20% variation
    const radius = baseRadius + radiusVariation

    // Calculate position (negative sin for positions above)
    const x = rectX + Math.cos(angle) * radius
    const y = rectY + Math.sin(angle) * radius

    // Make sure position is within canvas bounds and in top half (0 to height/2)
    const minX = eyeSize
    const maxX = canvas.width - eyeSize / 2
    const minY = eyeSize / 2 // Keep eye within canvas bounds
    const maxY = canvas.height / 2 // Top half only

    // Only add if in top half (0 to height/2)
    if (x >= minX && x <= maxX && y >= minY && y <= maxY && y <= canvas.height / 2) {
      eyePositions.push({ x, y })
    }
  }

  // Filter out overlapping eyes
  const minSpacing = eyeSize * 1.8
  const minSpacingSquared = minSpacing * minSpacing
  const filteredPositions = []

  for (const pos of eyePositions) {
    let isValid = true
    for (const selected of filteredPositions) {
      const dx = pos.x - selected.x
      const dy = pos.y - selected.y
      const distanceSquared = dx * dx + dy * dy

      if (distanceSquared < minSpacingSquared) {
        isValid = false
        break
      }
    }

    if (isValid) {
      filteredPositions.push(pos)
    }
  }

  return filteredPositions
}

// Function to create eyes with a given seed
async function createEyes(seed) {
  // Clear existing eyes
  irises = []
  eyeballMasks = []
  visibleEyeCount = 1  // Reset to show only first eye
  eyesClicked.clear()  // Reset clicked tracking
  eyesActivated.clear()  // Reset activated tracking
  showRectangle = false  // Reset rectangle visibility
  showRedRectangle = false  // Reset red rectangle visibility
  rectangleClicked = false  // Reset rectangle click tracking
  redRectangleStartTime = null  // Reset timer
  delayStarted = false  // Reset delay tracking
  delayTimer = 0
  maskClosing = false  // Reset mask closing state
  rectangleTurnedBlack = false  // Reset rectangle state tracking

  // Create seeded random number generator
  const seededRandom = createSeededRandom(seed)

  // Create rectangle in the center of the canvas (grid center) if not exists
  if (!rectangle) {
    const rectWidth = canvas.width * 0.05
    const rectHeight = canvas.height * 0.3
    const rectX = canvas.width / 2
    const rectY = canvas.height / 2
    rectangle = new Rectangle(
      rectX,
      rectY,
      rectWidth,
      rectHeight,
      "#000000"
    )

  }

  // Generate eye positions around the rectangle
  const eyePositions = generateEyesAroundRectangle(
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
    EYE_COUNT,
    eyeballMaskSize,
    seededRandom
  )

  // Create eyes at the generated positions
  for (const pos of eyePositions) {
    irises.push(new Iris(pos.x, pos.y, irisSize))
    eyeballMasks.push(new EyeballMask(pos.x, pos.y, eyeballMaskSize))
  }

  // Load all irises and masks
  await Promise.all([
    ...irises.map(iris => iris.load()),
    ...eyeballMasks.map(mask => mask.load())
  ])
}

// Load SleepingEyeBall images
async function loadSleepingEyeBall() {
  // Load sleeping-1.png
  const sleeping1Img = new Image()
  const sleeping1Promise = new Promise((resolve, reject) => {
    sleeping1Img.onload = () => {
      console.log("Sleeping-1 loaded", sleeping1Img.width, sleeping1Img.height)
      resolve()
    }
    sleeping1Img.onerror = (err) => {
      console.error("Error loading sleeping-1", err)
      reject(err)
    }
    sleeping1Img.src = "images/drawn/sleeping/sleeping-1.png"
  })
  SleepingEyeBall.images.push({ image: sleeping1Img, promise: sleeping1Promise })
  await sleeping1Promise
}

// Load animatedEyeBall images
async function loadAnimatedEyeBall() {
  // Load eyeball-1.png
  const eyeball1Img = new Image()
  const eyeball1Promise = new Promise((resolve, reject) => {
    eyeball1Img.onload = () => {
      console.log("Eyeball-1 loaded", eyeball1Img.width, eyeball1Img.height)
      resolve()
    }
    eyeball1Img.onerror = (err) => {
      console.error("Error loading eyeball-1", err)
      reject(err)
    }
    eyeball1Img.src = "images/drawn/eye-ball/eyeball-1.png"
  })
  animatedEyeBall.images.push({ image: eyeball1Img, promise: eyeball1Promise })
  await eyeball1Promise
}

// Load closedMouth images
async function loadClosedMouth() {
  // Load closed-mouth.png
  const closedMouthImg = new Image()
  const closedMouthPromise = new Promise((resolve, reject) => {
    closedMouthImg.onload = () => {
      console.log("Closed-mouth loaded", closedMouthImg.width, closedMouthImg.height)
      resolve()
    }
    closedMouthImg.onerror = (err) => {
      console.error("Error loading closed-mouth", err)
      reject(err)
    }
    closedMouthImg.src = "images/drawn/mouth/closed-mouth.png"
  })
  closedMouth.images.push({ image: closedMouthImg, promise: closedMouthPromise })
  await closedMouthPromise
}

// Load openedMouth images
async function loadOpenedMouth() {
  // Load opened-mouth.png
  const openedMouthImg = new Image()
  const openedMouthPromise = new Promise((resolve, reject) => {
    openedMouthImg.onload = () => {
      console.log("Opened-mouth loaded", openedMouthImg.width, openedMouthImg.height)
      resolve()
    }
    openedMouthImg.onerror = (err) => {
      console.error("Error loading opened-mouth", err)
      reject(err)
    }
    openedMouthImg.src = "images/drawn/mouth/opened-mouth.png"
  })
  openedMouth.images.push({ image: openedMouthImg, promise: openedMouthPromise })
  await openedMouthPromise
}

// Check if a point is inside an SVG (same radius as eyeballMask)
function isPointInSVG(x, y, centerX, centerY, radius) {
  const dx = x - centerX
  const dy = y - centerY
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= radius
}

// Check if a point is inside a rectangle
function isPointInRectangle(x, y, rect) {
  const left = rect.x - rect.width / 2
  const right = rect.x + rect.width / 2
  const top = rect.y - rect.height / 2
  const bottom = rect.y + rect.height / 2
  return x >= left && x <= right && y >= top && y <= bottom
}

async function init() {
  renderer.resize()
  await new Promise(resolve => requestAnimationFrame(resolve))
  renderer.resize()

  // Load SleepingEyeBall images
  await loadSleepingEyeBall()

  // Load animatedEyeBall images
  await loadAnimatedEyeBall()

  // Load mouth images
  await loadClosedMouth()
  await loadOpenedMouth()

  // Create initial eyes
  await createEyes(SEED)

  run(update)
}

// Helper function to update iris position with boundary constraint
function updateIrisPosition(iris, eyeballMask, mouseX, mouseY) {
  // Calculate desired iris position (mouse position)
  const desiredX = mouseX
  const desiredY = mouseY

  // Get mask center and radius
  const maskCenterX = eyeballMask.x
  const maskCenterY = eyeballMask.y
  const maskRadius = eyeballMask.getRadius()

  // Calculate iris radius (approximate - using half the size)
  const irisRadius = iris.size / 2

  // Maximum distance from mask center so that half iris stays inside
  // When half iris is outside, it blocks: maskRadius - irisRadius/2
  const maxDistance = maskRadius - irisRadius / 2

  // Calculate distance from mask center to desired position
  const dx = desiredX - maskCenterX
  const dy = desiredY - maskCenterY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Constrain the position if it exceeds the maximum distance
  let constrainedX = desiredX
  let constrainedY = desiredY

  if (distance > maxDistance) {
    // Normalize direction and scale to max distance
    const angle = Math.atan2(dy, dx)
    constrainedX = maskCenterX + Math.cos(angle) * maxDistance
    constrainedY = maskCenterY + Math.sin(angle) * maxDistance
  }

  // Update iris position
  iris.setPosition(constrainedX, constrainedY)
}

function update(dt) {
  // Update mask animation
  mask.update(dt)

  // Get mouse position
  let mouseX = null
  let mouseY = null

  if (input.hasStarted()) {
    const canvasRect = canvas.getBoundingClientRect()
    const pixelRatio = window.devicePixelRatio
    mouseX = (input.getX() / pixelRatio - canvasRect.left) * pixelRatio
    mouseY = (input.getY() / pixelRatio - canvasRect.top) * pixelRatio
  }

  // Handle click detection
  if (input.isDown() && mouseX !== null && mouseY !== null) {
    // Check if clicked on any visible eye SVG (not yet activated)
    for (let i = 0; i < visibleEyeCount && i < irises.length; i++) {
      if (!eyesActivated.has(i)) {
        const eyeballMask = eyeballMasks[i]
        const svgRadius = eyeballMask.getRadius()
        if (isPointInSVG(mouseX, mouseY, eyeballMask.x, eyeballMask.y, svgRadius)) {
          // Activate this eye (switch from SVG to eyeballMask)
          eyesActivated.add(i)
          eyesClicked.add(i)

          // Reveal next eye if not all are visible yet
          if (visibleEyeCount < EYE_COUNT) {
            visibleEyeCount++
          }

          // Check if all visible eyes have been activated and all eyes are displayed
          if (eyesActivated.size === visibleEyeCount && visibleEyeCount === EYE_COUNT) {
            showRectangle = true
          }
          console.log(`Eye ${i} SVG clicked - activated. Total activated: ${eyesActivated.size}/${visibleEyeCount} visible, ${EYE_COUNT} total`)
          break
        }
      }
    }

    // Check if clicked on black rectangle
    if (rectangle && showRectangle && !rectangleClicked && !showRedRectangle && isPointInRectangle(mouseX, mouseY, rectangle)) {
      rectangleClicked = true
      showRedRectangle = true
      redRectangleStartTime = Date.now()
      console.log("Black rectangle clicked - showing red rectangle")
    }
  }

  // Check if 1 second has passed since red rectangle appeared
  if (showRedRectangle && redRectangleStartTime !== null) {
    const elapsed = Date.now() - redRectangleStartTime
    if (elapsed >= 1000) {
      showRedRectangle = false
      rectangleClicked = false
      redRectangleStartTime = null
      rectangleTurnedBlack = true  // Mark that rectangle has turned back to black
      // Hide cursor when closed-mouth reappears
      document.body.classList.remove("show-cursor")
      console.log("Switching back to black rectangle")
    }
  }

  // Start delay timer when rectangle turns back to black (end state)
  if (rectangleTurnedBlack && !delayStarted && !maskClosing) {
    delayStarted = true
    delayTimer = 0
    console.log("Rectangle turned black - starting delay timer")
  }

  // Update delay timer
  if (delayStarted && !maskClosing) {
    delayTimer += dt
    // After delay duration, start closing the mask with animation
    if (delayTimer >= DELAY_DURATION) {
      maskClosing = true
      mask.setExpanded(false) // Start closing animation
      console.log("Starting mask closing animation")
    }
  }

  // Apply mask and draw content inside
  mask.applyMask(ctx, () => {
    // Update and draw visible eyes only
    for (let i = 0; i < visibleEyeCount && i < irises.length; i++) {
      const iris = irises[i]
      const eyeballMask = eyeballMasks[i]

      if (eyesActivated.has(i)) {
        // When closed mouth reappears, show sleeping eyes without iris
        if (rectangleTurnedBlack) {
          // Draw SleepingEyeBall image when closed mouth reappears (eyes close)
          if (SleepingEyeBall.images.length > 0) {
            const sleepingImage = SleepingEyeBall.images[0].image
            if (sleepingImage && sleepingImage.complete) {
              const drawX = eyeballMask.x - eyeballMaskSize / 2
              const drawY = eyeballMask.y - eyeballMaskSize / 2

              ctx.drawImage(sleepingImage, drawX, drawY, eyeballMaskSize, eyeballMaskSize)
            }
          }
        } else {
          // Draw activated eye (eyeballMask with iris)
          // Update iris position if mouse is available
          if (mouseX !== null && mouseY !== null) {
            updateIrisPosition(iris, eyeballMask, mouseX, mouseY)
          }

          // Draw eye
          ctx.save()
          eyeballMask.createClipPath(ctx)
          iris.draw(ctx)
          ctx.restore()
          // eyeballMask.drawStroke(ctx)  // Stroke made invisible

          // Draw animatedEyeBall on top of eyeballMask
          if (animatedEyeBall.images.length > 0) {
            const eyeballImage = animatedEyeBall.images[0].image
            if (eyeballImage && eyeballImage.complete) {
              const scaledSize = eyeballMaskSize * animatedEyeBallScale
              const drawX = eyeballMask.x - scaledSize / 2
              const drawY = eyeballMask.y - scaledSize / 2

              ctx.drawImage(eyeballImage, drawX, drawY, scaledSize, scaledSize)
            }
          }
        }
      } else {
        // Draw SleepingEyeBall image for non-activated eyes
        if (SleepingEyeBall.images.length > 0) {
          const sleepingImage = SleepingEyeBall.images[0].image
          if (sleepingImage && sleepingImage.complete) {
            const drawX = eyeballMask.x - eyeballMaskSize / 2
            const drawY = eyeballMask.y - eyeballMaskSize / 2

            ctx.drawImage(sleepingImage, drawX, drawY, eyeballMaskSize, eyeballMaskSize)
          }
        }
      }
    }

    // Draw mouth when last eye is clicked (draw on top)
    if (rectangle && showRectangle) {
      // Show opened mouth if clicked, otherwise show closed mouth
      if (showRedRectangle && openedMouth.images.length > 0) {
        const openedMouthImage = openedMouth.images[0].image
        if (openedMouthImage && openedMouthImage.complete) {
          ctx.save()
          // Translate to rectangle center
          ctx.translate(rectangle.x, rectangle.y)
          // Rotate 90 degrees
          ctx.rotate(Math.PI / 2)
          // Calculate aspect ratio and scale to fit rectangle
          const imageAspect = openedMouthImage.width / openedMouthImage.height
          const rectAspect = rectangle.width / rectangle.height
          let drawWidth, drawHeight
          if (imageAspect > rectAspect) {
            // Image is wider relative to its height - fit to rectangle height
            drawHeight = rectangle.height * openedMouthScale
            drawWidth = drawHeight * imageAspect
          } else {
            // Image is taller relative to its width - fit to rectangle width
            drawWidth = rectangle.width * openedMouthScale
            drawHeight = drawWidth / imageAspect
          }
          // Draw centered at origin (after translation and rotation)
          ctx.drawImage(openedMouthImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
          ctx.restore()
        }
      } else if (closedMouth.images.length > 0) {
        const closedMouthImage = closedMouth.images[0].image
        if (closedMouthImage && closedMouthImage.complete) {
          ctx.save()
          // Translate to rectangle center
          ctx.translate(rectangle.x, rectangle.y)
          // Rotate 90 degrees
          ctx.rotate(Math.PI / 2)
          // Calculate aspect ratio and scale to fit rectangle
          const imageAspect = closedMouthImage.width / closedMouthImage.height
          const rectAspect = rectangle.width / rectangle.height
          let drawWidth, drawHeight
          if (imageAspect > rectAspect) {
            // Image is wider relative to its height - fit to rectangle height
            drawHeight = rectangle.height * closedMouthScale
            drawWidth = drawHeight * imageAspect
          } else {
            // Image is taller relative to its width - fit to rectangle width
            drawWidth = rectangle.width * closedMouthScale
            drawHeight = drawWidth / imageAspect
          }
          // Draw centered at origin (after translation and rotation)
          ctx.drawImage(closedMouthImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
          ctx.restore()
        }
      }
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

init()

