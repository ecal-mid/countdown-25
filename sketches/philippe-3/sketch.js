import { createEngine } from "../_shared/engine.js"
import { Spring } from "../_shared/spring.js"
import { NoisyEllipseMask } from "./noisyEllipseMask.js"
import { Instance1 } from "./instance-1.js"
import { Instance2 } from "./instance-2.js"
import { Instance3 } from "./instance-3.js"

const { renderer, input, run, finish } = createEngine()
const { ctx, canvas } = renderer

const spring = new Spring({
  position: 0,
  frequency: 2.5,
  halfLife: 0.05
})

// Create mask instance with configuration
const mask = new NoisyEllipseMask(canvas, input, {
  margin: 40,
  ellipseVertices: 320,
  noiseStrength: 50,
  noiseSpeed: 2.0,
  noiseDistance: 15.0,
  springFrequency: 1.5,
  springHalfLife: 0.1
})

const INSTANCE_COUNT = 900
const WIGGLE_DISTANCE = 20
const WIGGLE_SPEED = 10

let artBoards = []
let hoverPoint = { x: 0, y: 0 }
let initialMousePos = { x: 0, y: 0 }
let maxDistance = 0
let wiggleTime = 0
let instancesSnapped = false
let snapStartPositions = [] // Store positions when snapping starts
let interpolationProgress = 0
const INTERPOLATION_SPEED = 2.0 // How fast to interpolate to final position
let delayStarted = false
let delayTimer = 0
const DELAY_DURATION = 3.0 // 5 seconds delay after instances snap
let maskClosing = false

let instanceInitialPositions = []
let instanceFinalPositions = []
let instanceSpringsX = []
let instanceSpringsY = []

// Initialize ArtBoards
async function initArtBoards() {
  renderer.resize()
  await new Promise(resolve => requestAnimationFrame(resolve))
  renderer.resize()

  // Get initial mouse position
  const canvasRect = canvas.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio

  // Try to get mouse position - check if it's already available or wait for it
  let initialX = canvas.width / 2
  let initialY = canvas.height / 2

  // Function to get mouse position from input system
  const getMousePosition = () => {
    if (input.hasStarted()) {
      const x = (input.getX() / pixelRatio - canvasRect.left) * pixelRatio
      const y = (input.getY() / pixelRatio - canvasRect.top) * pixelRatio
      // Make sure position is within canvas bounds
      if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
        return { x, y }
      }
    }
    return null
  }

  // Try to get position immediately
  let mousePos = getMousePosition()

  if (!mousePos) {
    // If mouse hasn't moved yet, wait for it (with timeout)
    let frameCount = 0
    await new Promise(resolve => {
      const checkMouse = () => {
        mousePos = getMousePosition()
        if (mousePos) {
          initialX = mousePos.x
          initialY = mousePos.y
          resolve()
        } else if (frameCount < 60) {
          // Wait up to ~1 second (60 frames) for mouse movement
          frameCount++
          requestAnimationFrame(checkMouse)
        } else {
          // Fallback to center if mouse hasn't moved
          resolve()
        }
      }
      checkMouse()
    })
  } else {
    initialX = mousePos.x
    initialY = mousePos.y
  }

  initialMousePos.x = initialX
  initialMousePos.y = initialY

  // Calculate center of canvas
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2

  // Calculate direction from center to initial mouse position
  const dirX = initialX - centerX
  const dirY = initialY - centerY

  // Normalize direction
  const dirLength = Math.sqrt(dirX * dirX + dirY * dirY)

  // If mouse is at center or very close, use a default direction (e.g., top-right)
  let normalizedDirX, normalizedDirY
  if (dirLength < 1) {
    // Default direction: top-right corner
    const defaultDirX = 1
    const defaultDirY = 1
    const defaultLength = Math.sqrt(defaultDirX * defaultDirX + defaultDirY * defaultDirY)
    normalizedDirX = defaultDirX / defaultLength
    normalizedDirY = defaultDirY / defaultLength
  } else {
    normalizedDirX = dirX / dirLength
    normalizedDirY = dirY / dirLength
  }

  // Calculate hover point at the edge/extremity of canvas in the opposite direction
  // Find the edge point in the opposite direction from initial mouse
  const oppositeDirX = -normalizedDirX
  const oppositeDirY = -normalizedDirY

  // Find intersection with canvas edges
  let edgeX, edgeY
  if (Math.abs(oppositeDirX) > Math.abs(oppositeDirY)) {
    // Intersect with left or right edge
    const t = oppositeDirX > 0 ? (canvas.width - centerX) / oppositeDirX : -centerX / oppositeDirX
    edgeX = centerX + oppositeDirX * t
    edgeY = centerY + oppositeDirY * t
  } else {
    // Intersect with top or bottom edge
    const t = oppositeDirY > 0 ? (canvas.height - centerY) / oppositeDirY : -centerY / oppositeDirY
    edgeX = centerX + oppositeDirX * t
    edgeY = centerY + oppositeDirY * t
  }

  hoverPoint.x = edgeX
  hoverPoint.y = edgeY

  // Calculate maximum distance from center to hover point (edge)
  const dx = hoverPoint.x - centerX
  const dy = hoverPoint.y - centerY
  maxDistance = Math.sqrt(dx * dx + dy * dy)

  // Ensure maxDistance is valid (at least a minimum value)
  if (maxDistance < 1) {
    maxDistance = Math.min(canvas.width, canvas.height) / 2
  }

  console.log(`Center: (${centerX.toFixed(0)}, ${centerY.toFixed(0)}), Initial mouse: (${initialX.toFixed(0)}, ${initialY.toFixed(0)}), Hover point (edge): (${hoverPoint.x.toFixed(0)}, ${hoverPoint.y.toFixed(0)})`)

  // CHANGE SIZE OF INSTANCES HERE
  const size = Math.min(canvas.width, canvas.height) * 0.055
  const artBoardClasses = [Instance1, Instance2, Instance3]

  for (let i = 0; i < INSTANCE_COUNT; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height

    const ArtBoardClass = artBoardClasses[i % 3]
    const artBoard = new ArtBoardClass(x, y, size, size)
    await artBoard.load()
    artBoards.push(artBoard)

    instanceSpringsX.push(new Spring({
      position: x,
      frequency: 2.5,
      halfLife: 0.05
    }))
    instanceSpringsY.push(new Spring({
      position: y,
      frequency: 2.5,
      halfLife: 0.05
    }))

    instanceInitialPositions.push({ x, y })
    instanceFinalPositions.push({ x, y })
  }

  const rectangles = []
  const rectWidth = canvas.width * 0.1
  const rectHeight = canvas.height * 0.8
  const gap = canvas.width * 0.05
  const totalWidth = 3 * rectWidth + 2 * gap
  const startX = (canvas.width - totalWidth) / 2

  for (let i = 0; i < 3; i++) {
    rectangles.push({
      x: startX + i * (rectWidth + gap),
      y: centerY - rectHeight / 2,
      width: rectWidth,
      height: rectHeight
    })
  }

  const instancesPerRect = Math.floor(INSTANCE_COUNT / 3)
  const remainder = INSTANCE_COUNT % 3
  let instanceIndex = 0

  for (let rectIndex = 0; rectIndex < 3; rectIndex++) {
    const rect = rectangles[rectIndex]
    const countForThisRect = instancesPerRect + (rectIndex < remainder ? 1 : 0)

    const minX = rect.x
    const maxX = rect.x + rect.width
    const minY = rect.y
    const maxY = rect.y + rect.height - size

    for (let i = 0; i < countForThisRect; i++) {
      instanceFinalPositions[instanceIndex].x = minX + Math.random() * (maxX - minX)
      instanceFinalPositions[instanceIndex].y = minY + Math.random() * (maxY - minY)
      instanceIndex++
    }
  }
}

initArtBoards().then(() => {
  run(update)
})


function update(dt) {
  // Update mask animation
  mask.update(dt)

  // Update main spring (mask closing is handled by mask's own spring)
  if (input.isPressed()) {
    spring.target = 0
  }
  else {
    spring.target = 1
  }

  spring.step(dt)

  const scale = Math.max(spring.position, 0)
  wiggleTime += dt * WIGGLE_SPEED

  const rectWidth = canvas.width * 0.1
  const rectHeight = canvas.height * 0.8
  const gap = canvas.width * 0.05
  const totalWidth = 3 * rectWidth + 2 * gap
  const startX = (canvas.width - totalWidth) / 2

  // Calculate center of canvas
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2

  const instanceSize = Math.min(canvas.width, canvas.height) * 0.15

  // Convert mouse coordinates to canvas coordinates
  const canvasRect = canvas.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio
  let mouseX = (input.getX() / pixelRatio - canvasRect.left) * pixelRatio
  let mouseY = (input.getY() / pixelRatio - canvasRect.top) * pixelRatio

  // If mouse hasn't moved, use center position
  if (!input.hasStarted()) {
    mouseX = centerX
    mouseY = centerY
  }

  // Calculate distance from mouse to center
  const dxFromCenter = mouseX - centerX
  const dyFromCenter = mouseY - centerY
  const distanceFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter)

  // Only check distance progress if maxDistance is valid (greater than 0) and mouse has moved
  if (maxDistance > 0 && input.hasStarted()) {
    // Calculate progress: 0 at center, 1 at hover point (edge)
    const distanceProgress = Math.min(1, distanceFromCenter / maxDistance)

    // If mouse is 80% close to edge (80% of the way from center to edge), start interpolating to final positions
    if (distanceProgress >= 0.9 && !instancesSnapped) {
      instancesSnapped = true
      spring.target = 0
      // Store current positions when snapping starts
      snapStartPositions = []
      for (let i = 0; i < INSTANCE_COUNT; i++) {
        snapStartPositions.push({
          x: instanceSpringsX[i].position,
          y: instanceSpringsY[i].position
        })
      }
      interpolationProgress = 0
    }
  }

  // Update instance positions
  if (instancesSnapped) {
    // Interpolate smoothly to final positions
    interpolationProgress = Math.min(1, interpolationProgress + dt * INTERPOLATION_SPEED)

    // Check if interpolation is complete and start delay timer
    if (interpolationProgress >= 1 && !delayStarted) {
      delayStarted = true
      delayTimer = 0
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

    // Smooth interpolation curve (ease-out)
    const smoothProgress = 1 - Math.pow(1 - interpolationProgress, 3)

    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const currentX = instanceSpringsX[i].position
      const currentY = instanceSpringsY[i].position

      // Interpolate from snap start position to final position
      const startPos = snapStartPositions[i] || { x: currentX, y: currentY }
      const targetX = startPos.x + (instanceFinalPositions[i].x - startPos.x) * smoothProgress
      const targetY = startPos.y + (instanceFinalPositions[i].y - startPos.y) * smoothProgress

      // Calculate wiggle based on distance from final position to hover point (constant amplitude)
      const dx = instanceFinalPositions[i].x - hoverPoint.x
      const dy = instanceFinalPositions[i].y - hoverPoint.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const maxDist = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height)
      const normalizedDistance = Math.min(1, distance / maxDist)
      // Keep constant wiggle amplitude based on final position distance
      const wiggleAmplitude = normalizedDistance * WIGGLE_DISTANCE

      const wiggleOffsetX = Math.sin(wiggleTime + i * 0.1) * wiggleAmplitude
      const wiggleOffsetY = Math.cos(wiggleTime + i * 0.1) * wiggleAmplitude

      instanceSpringsX[i].target = targetX + wiggleOffsetX
      instanceSpringsY[i].target = targetY + wiggleOffsetY
      instanceSpringsX[i].step(dt)
      instanceSpringsY[i].step(dt)

      artBoards[i].x = Math.max(0, Math.min(canvas.width, instanceSpringsX[i].position))
      artBoards[i].y = Math.max(0, Math.min(canvas.height, instanceSpringsY[i].position))
    }
  } else {
    // Normal interaction with mouse position
    // Calculate blend based on distance from center: 0 at center, 1 at hover point (edge)
    const blend = maxDistance > 0 ? Math.min(1, distanceFromCenter / maxDistance) : 0

    // Apply smooth interpolation curve
    const smoothBlend = blend * blend * (3 - 2 * blend)

    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const blendedX = instanceInitialPositions[i].x * (1 - smoothBlend) + instanceFinalPositions[i].x * smoothBlend
      const blendedY = instanceInitialPositions[i].y * (1 - smoothBlend) + instanceFinalPositions[i].y * smoothBlend

      const currentX = instanceSpringsX[i].position
      const currentY = instanceSpringsY[i].position
      // Calculate wiggle based on distance from current position to hover point
      const dx = currentX - hoverPoint.x
      const dy = currentY - hoverPoint.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      const maxDist = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height)
      const normalizedDistance = Math.min(1, distance / maxDist)
      // More wiggle when further from hover point (closer to center), less when closer to hover point
      const wiggleAmplitude = normalizedDistance * WIGGLE_DISTANCE

      const wiggleOffsetX = Math.sin(wiggleTime + i * 0.1) * wiggleAmplitude
      const wiggleOffsetY = Math.cos(wiggleTime + i * 0.1) * wiggleAmplitude

      instanceSpringsX[i].target = blendedX + wiggleOffsetX
      instanceSpringsY[i].target = blendedY + wiggleOffsetY
      instanceSpringsX[i].step(dt)
      instanceSpringsY[i].step(dt)

      artBoards[i].x = Math.max(0, Math.min(canvas.width, instanceSpringsX[i].position))
      artBoards[i].y = Math.max(0, Math.min(canvas.height, instanceSpringsY[i].position))
    }
  }

  // Apply mask and draw content inside
  mask.applyMask(ctx, () => {
    // Draw white rectangles
    ctx.fillStyle = "white"
    for (let i = 0; i < 3; i++) {
      const x = startX + i * (rectWidth + gap)
      const y = centerY - rectHeight / 2
      ctx.fillRect(x, y, rectWidth, rectHeight)
    }

    // Draw artboards
    for (const artBoard of artBoards) {
      if (artBoard.image) {
        artBoard.draw(ctx, dt)
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
