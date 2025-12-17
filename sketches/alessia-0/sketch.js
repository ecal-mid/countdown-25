import { createEngine } from "../_shared/engine.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

async function loadSVG() {
  const response = await fetch("0.svg");
  const svgText = await response.text();
  document.getElementById("svg-container").innerHTML = svgText;

  // Add click handlers to all shapes
  const shapes = document.querySelectorAll(
    "svg path, svg rect, svg circle, svg ellipse, svg polygon"
  );

  console.log(`Found ${shapes.length} shapes`);

  shapes.forEach((shape, index) => {
    shape.style.pointerEvents = "fill";
    shape.filled = false; // Track fill state

    // Set initial stroke and fill if they don't exist
    if (!shape.getAttribute("stroke")) {
      shape.setAttribute("stroke", "#fff");
      shape.setAttribute("stroke-width", "2");
    }
    if (!shape.getAttribute("fill")) {
      shape.setAttribute("fill", "none");
    }

    console.log(`Shape ${index} original fill:`, shape.getAttribute("fill"));

    shape.addEventListener("click", function (e) {
      e.stopPropagation();

      if (this.filled) {
        this.style.cssText += "; fill: none !important; filter: none;";
        this.filled = false;
        console.log(
          `Unfilled shape ${index}. Filled shapes:`,
          getFilledShapes()
        );
      } else {
        this.style.cssText +=
          "; fill: #ffffffff !important; filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));";
        this.filled = true;
        console.log(`Filled shape ${index}. Filled shapes:`, getFilledShapes());
      }

      checkWinCondition();
    });
  });

  // Helper function to track filled shapes
  function getFilledShapes() {
    return Array.from(shapes)
      .map((s, i) => (s.filled ? i : null))
      .filter((i) => i !== null);
  }

  function checkWinCondition() {
    const filledShapes = getFilledShapes();
    const allFilled = filledShapes.length === shapes.length;
    const winCondition =
      JSON.stringify(filledShapes) === JSON.stringify([0, 1, 2, 4, 5, 6]);

    if (allFilled) {
      console.log("All shapes filled! Unfilling all in 500ms...");
      setTimeout(() => {
        shapes.forEach((shape) => {
          shape.style.cssText += "; fill: none !important; filter: none;";
          shape.filled = false;
        });
        console.log("All shapes unfilled");
      }, 500);
    }

    if (winCondition) {
      console.log("Win condition met! Fading shape 3 and enhancing light...");

      const filledShapeIndices = getFilledShapes();
      const shape3 = shapes[3];

      // Fade shape 3 and enhance glow on filled shapes
      shape3.style.transition = "opacity 1s ease-out, filter 1s ease-out";
      shape3.style.opacity = "0";
      shape3.style.filter = "drop-shadow(0 0 50px rgba(255, 255, 255, 0.3))";

      filledShapeIndices.forEach((shapeIndex) => {
        const shape = shapes[shapeIndex];
        shape.style.transition = "filter 1s ease-out";
        shape.style.filter = "drop-shadow(0 0 50px rgba(255, 255, 255, 1))";
      });

      // Wait for fade to complete, then start glitch
      setTimeout(() => {
        console.log("Starting glitch effect...");

        let glitchCount = 0;
        const glitchInterval = setInterval(() => {
          filledShapeIndices.forEach((shapeIndex) => {
            const shape = shapes[shapeIndex];
            if (glitchCount % 2 === 0) {
              shape.style.opacity = "0.3";
              shape.style.filter =
                "drop-shadow(0 0 100px rgba(255, 255, 255, 1))";
            } else {
              shape.style.opacity = "1";
              shape.style.filter =
                "drop-shadow(0 0 50px rgba(255, 255, 255, 1))";
            }
          });
          glitchCount++;

          if (glitchCount > 12) {
            clearInterval(glitchInterval);

            // Fade to invisible
            filledShapeIndices.forEach((shapeIndex) => {
              const shape = shapes[shapeIndex];
              shape.style.transition =
                "opacity 0.5s ease-out, filter 0.5s ease-out";
              shape.style.opacity = "0";
              shape.style.filter =
                "drop-shadow(0 0 0px rgba(255, 255, 255, 0))";
            });

            setTimeout(() => {
              console.log("Calling finish()...");
              finish();
            }, 500);
          }
        }, 80);
      }, 1000);
    }
  }

  // Also add click to SVG itself to debug
  const svg = document.querySelector("svg");
  svg.addEventListener("click", (e) => {
    console.log("SVG clicked, target:", e.target);
  });
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSVG);
} else {
  loadSVG();
}
