import { createEngine } from "../_shared/engine.js"
import { NoisyEllipseMask } from "./noisyEllipseMask.js"

const { renderer, input, math, run, finish, } = createEngine()
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

// Fly state
const fly = {
    x: 0,
    y: 0,
    radius: 25,
    vx: 0,
    vy: 0,
    visible: true,
    noiseOffsetX: Math.random() * 1000,
    noiseOffsetY: Math.random() * 1000,
    noiseTime: 0,
    wanderTargetX: 0,
    wanderTargetY: 0,
    wanderTime: 0
}

// Background color (0 = white, 1 = black)
let backgroundColor = 0

// Tracking state
let hoverTime = 0
let isHovering = false
const TRACKING_DURATION = 2 // seconds

// Mask closing variables
let delayStarted = false
let delayTimer = 0
const DELAY_DURATION = 3.0 // 3 seconds delay after background color changes
let maskClosing = false

// Flash overlay variables
let flashTime = 0
let isFlashing = false
const FLASH_IN_DURATION = 0.2 // seconds to flash in
const FLASH_HOLD_DURATION = 1.0 // seconds to stay at full opacity
const FLASH_OUT_DURATION = 1.0 // seconds to fade out
const FLASH_TOTAL_DURATION = FLASH_IN_DURATION + FLASH_HOLD_DURATION + FLASH_OUT_DURATION

// Fly movement parameters
const FLYING_SPEED = 200 // pixels per second - tweak this to adjust speed
const NOISE_AMPLITUDE = 500 // amplitude of organic noise movement
const NOISE_SPEED = 5.5 // speed of noise oscillation
const ORGANIC_JITTER = 10 // amount of random jitter for organic feel
const WANDER_FORCE = 1500 // force toward random wander targets
const WANDER_CHANGE_INTERVAL = 3 // seconds between wander target changes

// Tracking square parameters
const TRACKING_SQUARE_SIZE = 200 // size of the tracking square
const TRACKING_SQUARE_STROKE = 2 // stroke width

// Fly bounding area scale (0.0 to 1.0, smaller = more constrained)
const FLY_AREA_SCALE = 0.8 // Make the area 60% of the mask size

// Initialization flag
let initialized = false

// Fly image
let flyImage = null
// Crosshair images
let bigCrosshairImage = null
let pointerImage = null
// Background images (SVG)
let backgroundImage1 = null  // For backgroundColor === 0
let backgroundImage2 = null  // For backgroundColor === 1

// Crosshair rotation state
const crosshairRotation = {
    bigCrosshairAngle: 0,
    pointerAngle: 0,
    noiseTime: 0,
    bigCrosshairNoiseOffset: Math.random() * 1000,
    pointerNoiseOffset: Math.random() * 1000,
    bigCrosshairAmplitude: 1, // Maximum rotation amplitude for big crosshair in radians
    pointerAmplitude: 0.75, // Maximum rotation amplitude for pointer in radians
    noiseSpeed: 8.0 // Speed of noise oscillation
}

// Load images
async function loadImages() {
    // Load fly image
    flyImage = new Image()
    flyImage.src = 'images/fly/fly-1.png'
    await new Promise((resolve, reject) => {
        flyImage.onload = resolve
        flyImage.onerror = reject
    })

    // Load big crosshair image
    bigCrosshairImage = new Image()
    bigCrosshairImage.src = 'images/crosshair/big-crosshair.png'
    await new Promise((resolve, reject) => {
        bigCrosshairImage.onload = resolve
        bigCrosshairImage.onerror = reject
    })

    // Load pointer image
    pointerImage = new Image()
    pointerImage.src = 'images/crosshair/pointer.png'
    await new Promise((resolve, reject) => {
        pointerImage.onload = resolve
        pointerImage.onerror = reject
    })

    // Load background SVG images
    backgroundImage1 = new Image()
    backgroundImage1.src = 'images/background/background-1.svg'
    await new Promise((resolve, reject) => {
        backgroundImage1.onload = resolve
        backgroundImage1.onerror = reject
    })

    backgroundImage2 = new Image()
    backgroundImage2.src = 'images/background/background-2.svg'
    await new Promise((resolve, reject) => {
        backgroundImage2.onload = resolve
        backgroundImage2.onerror = reject
    })
}

// Simple noise function using sine waves for organic movement
function noise(t, offset) {
    return Math.sin(t * 0.5 + offset) * 0.5 +
        Math.sin(t * 1.3 + offset * 1.7) * 0.3 +
        Math.sin(t * 2.1 + offset * 2.3) * 0.2
}

// Helper function to calculate the bounding rectangle inside the mask
function getMaskBounds() {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Calculate mask dimensions (same logic as in NoisyEllipseMask)
    const maxRadiusX = (canvas.width / 2) - mask.margin
    const maxRadiusY = (canvas.height / 2) - mask.margin
    const maxRadius = Math.min(maxRadiusX, maxRadiusY)

    // Use maximum radius for static bounding area (not current spring position)
    const radius = maxRadius
    const scaleX = maxRadiusX / maxRadius
    const scaleY = maxRadiusY / maxRadius
    const radiusX = radius * scaleX
    const radiusY = radius * scaleY

    // Calculate safe rectangle bounds (accounting for noise and fly radius)
    // Apply scale factor to make area smaller, then subtract noise strength and fly radius
    const scaledRadiusX = radiusX * FLY_AREA_SCALE
    const scaledRadiusY = radiusY * FLY_AREA_SCALE
    const safeRadiusX = Math.max(0, scaledRadiusX - mask.noiseStrength - fly.radius)
    const safeRadiusY = Math.max(0, scaledRadiusY - mask.noiseStrength - fly.radius)

    return {
        left: centerX - safeRadiusX,
        right: centerX + safeRadiusX,
        top: centerY - safeRadiusY,
        bottom: centerY + safeRadiusY,
        width: safeRadiusX * 2,
        height: safeRadiusY * 2
    }
}

function update(dt) {
    // Update mask animation
    mask.update(dt)

    // Update crosshair rotation noise time
    crosshairRotation.noiseTime += dt * crosshairRotation.noiseSpeed

    // Calculate lock progress (0 = not tracking, 1 = fully locked)
    let lockProgress = 0
    if (!fly.visible) {
        lockProgress = 1 // Fully locked when fly is caught
    } else if (isHovering) {
        // Gradually increase lock progress as hover time increases
        lockProgress = Math.min(hoverTime / TRACKING_DURATION, 1)
    }

    // Calculate rotation damping based on lock progress
    // Rotation stops at 90% of tracking (0.9 lock progress)
    // Map lockProgress 0-0.9 to rotationDamping 1-0
    const rotationDamping = Math.max(0, 1 - (lockProgress / 0.9))

    // Update crosshair rotation using noise (janky rotation)
    if (rotationDamping > 0) {
        const bigCrosshairNoise = noise(crosshairRotation.noiseTime, crosshairRotation.bigCrosshairNoiseOffset)
        const pointerNoise = noise(crosshairRotation.noiseTime * 1.3, crosshairRotation.pointerNoiseOffset)

        // Apply janky rotation with damping
        crosshairRotation.bigCrosshairAngle = bigCrosshairNoise * crosshairRotation.bigCrosshairAmplitude * rotationDamping
        crosshairRotation.pointerAngle = pointerNoise * crosshairRotation.pointerAmplitude * rotationDamping * -1 // Opposite direction
    } else {
        // Fully locked - no rotation
        crosshairRotation.bigCrosshairAngle = 0
        crosshairRotation.pointerAngle = 0
    }

    // Update noise time for organic movement
    fly.noiseTime += dt * NOISE_SPEED

    // Get mask bounds for constraining fly
    const maskBounds = getMaskBounds()

    // Initialize fly position on first frame
    if (!initialized && canvas.width > 0 && canvas.height > 0) {
        // Initialize fly position randomly within mask bounds
        fly.x = maskBounds.left + Math.random() * maskBounds.width
        fly.y = maskBounds.top + Math.random() * maskBounds.height
        // Set initial wander target within mask bounds
        fly.wanderTargetX = maskBounds.left + Math.random() * maskBounds.width
        fly.wanderTargetY = maskBounds.top + Math.random() * maskBounds.height
        initialized = true
    }

    if (!initialized) return
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Get mouse position
    const mouseX = input.getX()
    const mouseY = input.getY()

    // Calculate tracking square position (mouse in center)
    const trackingSquareX = mouseX - TRACKING_SQUARE_SIZE / 2
    const trackingSquareY = mouseY - TRACKING_SQUARE_SIZE / 2

    // Check if fly is inside the tracking square
    const isFlyInTrackingArea = fly.visible &&
        fly.x >= trackingSquareX &&
        fly.x <= trackingSquareX + TRACKING_SQUARE_SIZE &&
        fly.y >= trackingSquareY &&
        fly.y <= trackingSquareY + TRACKING_SQUARE_SIZE

    // Handle hover state
    if (isFlyInTrackingArea) {
        if (!isHovering) {
            // Start tracking
            isHovering = true
            hoverTime = 0
        }

        // Accumulate hover time
        hoverTime += dt

        // Move fly toward center
        const dx = centerX - fly.x
        const dy = centerY - fly.y
        const distanceToCenter = math.len(dx, dy)

        // Calculate remaining time
        const remainingTime = TRACKING_DURATION - hoverTime

        if (distanceToCenter > 1 && remainingTime > 0) {
            // Calculate speed needed to reach center in remaining time
            // Use either the configured speed or the speed needed to reach center in time, whichever is faster
            const requiredSpeed = distanceToCenter / remainingTime
            const speed = Math.max(FLYING_SPEED, requiredSpeed) * dt

            // Normalize direction and apply speed
            const moveX = (dx / distanceToCenter) * speed
            const moveY = (dy / distanceToCenter) * speed

            // Add organic noise to movement direction
            const noiseX = noise(fly.noiseTime, fly.noiseOffsetX) * NOISE_AMPLITUDE * dt
            const noiseY = noise(fly.noiseTime, fly.noiseOffsetY) * NOISE_AMPLITUDE * dt

            // Apply movement with organic noise
            fly.x += moveX + noiseX
            fly.y += moveY + noiseY

            // Add organic jitter (reduced when close to center)
            const jitterAmount = Math.min(distanceToCenter / 100, 1) * ORGANIC_JITTER
            fly.x += (Math.random() - 0.5) * jitterAmount * dt
            fly.y += (Math.random() - 0.5) * jitterAmount * dt

            // Constrain fly to mask bounds
            fly.x = math.clamp(fly.x, maskBounds.left, maskBounds.right)
            fly.y = math.clamp(fly.y, maskBounds.top, maskBounds.bottom)
        } else {
            // Snap to center when time is up or already there (but ensure center is within bounds)
            if (hoverTime >= TRACKING_DURATION || distanceToCenter <= 1) {
                fly.x = math.clamp(centerX, maskBounds.left, maskBounds.right)
                fly.y = math.clamp(centerY, maskBounds.top, maskBounds.bottom)
            }
        }
    } else {
        // Not hovering - fly moves around more actively
        isHovering = false
        hoverTime = 0

        if (fly.visible) {
            // Reset velocity when transitioning from tracking to wander to prevent teleporting
            fly.vx = 0
            fly.vy = 0
            // Update wander target periodically to encourage exploration
            fly.wanderTime += dt
            if (fly.wanderTime >= WANDER_CHANGE_INTERVAL) {
                // Pick a new random target within mask bounds
                fly.wanderTargetX = maskBounds.left + Math.random() * maskBounds.width
                fly.wanderTargetY = maskBounds.top + Math.random() * maskBounds.height
                fly.wanderTime = 0
            }

            // Calculate direction toward wander target
            const wanderDx = fly.wanderTargetX - fly.x
            const wanderDy = fly.wanderTargetY - fly.y
            const wanderDist = math.len(wanderDx, wanderDy)

            // Add wander force (weaker when far, stronger when close to encourage exploration)
            if (wanderDist > 10) {
                const wanderStrength = WANDER_FORCE * (1 - Math.min(wanderDist / (canvas.width * 0.5), 1))
                fly.vx += (wanderDx / wanderDist) * wanderStrength * dt
                fly.vy += (wanderDy / wanderDist) * wanderStrength * dt
            }

            // Organic noise-based velocity changes
            const noiseVelX = noise(fly.noiseTime, fly.noiseOffsetX) * 300
            const noiseVelY = noise(fly.noiseTime, fly.noiseOffsetY + 100) * 300

            // Apply organic noise to velocity
            fly.vx += noiseVelX * dt
            fly.vy += noiseVelY * dt

            // Add random perturbations for more organic feel
            fly.vx += (Math.random() - 0.5) * 350 * dt
            fly.vy += (Math.random() - 0.5) * 350 * dt

            // Less damping for more erratic movement and better exploration
            fly.vx *= 0.94
            fly.vy *= 0.94

            // Add occasional quick direction changes (more organic)
            if (Math.random() < 0.08) {
                const burstAngle = Math.random() * Math.PI * 2
                const burstForce = 500 + Math.random() * 300
                fly.vx += Math.cos(burstAngle) * burstForce * dt
                fly.vy += Math.sin(burstAngle) * burstForce * dt
            }

            // Update position with velocity
            fly.x += fly.vx * dt
            fly.y += fly.vy * dt

            // Add additional organic position noise
            const posNoiseX = noise(fly.noiseTime * 1.7, fly.noiseOffsetX + 50) * NOISE_AMPLITUDE * dt
            const posNoiseY = noise(fly.noiseTime * 1.7, fly.noiseOffsetY + 150) * NOISE_AMPLITUDE * dt
            fly.x += posNoiseX
            fly.y += posNoiseY

            // Constrain fly to mask bounds with bounce effect
            if (fly.x < maskBounds.left || fly.x > maskBounds.right) {
                fly.vx *= -0.7
                fly.x = math.clamp(fly.x, maskBounds.left, maskBounds.right)
                // Add a push away from the edge
                fly.vx += (fly.x < centerX ? 1 : -1) * 200 * dt
            }
            if (fly.y < maskBounds.top || fly.y > maskBounds.bottom) {
                fly.vy *= -0.7
                fly.y = math.clamp(fly.y, maskBounds.top, maskBounds.bottom)
                // Add a push away from the edge
                fly.vy += (fly.y < centerY ? 1 : -1) * 200 * dt
            }
        }
    }

    // Handle click
    if (input.isDown() && fly.visible) {
        // Check if click is on the fly
        const clickDist = math.dist(mouseX, mouseY, fly.x, fly.y)
        if (clickDist < fly.radius) {
            fly.visible = false
            // Start flash animation (background will change during flash)
            isFlashing = true
            flashTime = 0
        }
    }

    // Update flash animation and change background during flash
    if (isFlashing) {
        flashTime += dt
        // Change background when flash reaches hold phase (after flash in)
        if (flashTime >= FLASH_IN_DURATION && backgroundColor === 0) {
            backgroundColor = 1 // Change to black
            // Start delay timer when background color changes
            if (!delayStarted && !maskClosing) {
                delayStarted = true
                delayTimer = 0
                console.log("Background color changed - starting delay timer")
            }
        }
        if (flashTime >= FLASH_TOTAL_DURATION) {
            isFlashing = false
            flashTime = 0
        }
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
        // Draw background SVG image with 80% opacity
        const currentBackgroundImage = backgroundColor === 0 ? backgroundImage1 : backgroundImage2
        if (currentBackgroundImage) {
            ctx.save()
            ctx.globalAlpha = 0.7
            // Draw SVG to fill entire canvas
            ctx.drawImage(currentBackgroundImage, 0, 0, canvas.width, canvas.height)
            ctx.restore()
        } else {
            // Fallback to solid color if images haven't loaded yet
            ctx.save()
            ctx.globalAlpha = 0.8
            ctx.fillStyle = backgroundColor === 0 ? '#ffffff' : '#f0ead6'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.restore()
        }

        // Draw crosshair (big crosshair as outer, pointer as inner) with rotation
        if (bigCrosshairImage) {
            const crosshairSize = TRACKING_SQUARE_SIZE
            ctx.save()
            ctx.translate(mouseX, mouseY)
            ctx.rotate(crosshairRotation.bigCrosshairAngle)
            ctx.drawImage(bigCrosshairImage, -crosshairSize / 2, -crosshairSize / 2, crosshairSize, crosshairSize)
            ctx.restore()
        }

        // Draw pointer centered inside the big crosshair with rotation
        if (pointerImage) {
            const pointerSize = TRACKING_SQUARE_SIZE * 0.5 // Make pointer smaller than big crosshair
            ctx.save()
            ctx.translate(mouseX, mouseY)
            ctx.rotate(crosshairRotation.pointerAngle)
            ctx.drawImage(pointerImage, -pointerSize / 2, -pointerSize / 2, pointerSize, pointerSize)
            ctx.restore()
        }

        // Draw fly
        if (fly.visible && flyImage) {
            // Draw fly image centered on fly position
            const imageSize = fly.radius * 5
            const x = fly.x - imageSize / 2
            const y = fly.y - imageSize / 2
            ctx.drawImage(flyImage, x, y, imageSize, imageSize)
        }
    })




    // Draw white flash overlay
    if (isFlashing) {
        let flashOpacity = 0
        if (flashTime <= FLASH_IN_DURATION) {
            // Flash in: 0 to 1 over FLASH_IN_DURATION
            flashOpacity = flashTime / FLASH_IN_DURATION
        } else if (flashTime <= FLASH_IN_DURATION + FLASH_HOLD_DURATION) {
            // Hold at full opacity
            flashOpacity = 1
        } else {
            // Fade out: 1 to 0 over FLASH_OUT_DURATION
            const fadeOutTime = flashTime - (FLASH_IN_DURATION + FLASH_HOLD_DURATION)
            flashOpacity = 1 - (fadeOutTime / FLASH_OUT_DURATION)
        }

        ctx.save()
        ctx.globalAlpha = flashOpacity
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
    }

    // Finish sequence when mask is fully closed (check mask spring position)
    if (maskClosing) {
        // Check if mask spring has reached 0 (fully closed)
        const maskRadius = mask.spring.position
        if (maskRadius <= 1) { // Use small threshold for floating point comparison
            finish()
        }
    }
}

// Load images and start the loop
loadImages().then(() => {
    run(update)
})

