let dOutter = null;
let dInner = null;
let svgLoaded = false;
let onSvgLoadCallbacks = [];

function onSvgLoad(callback) {
  if (svgLoaded) {
    callback();
  } else {
    onSvgLoadCallbacks.push(callback);
  }
}

let loadedCount = 0;
function checkAllLoaded() {
  loadedCount++;
  if (loadedCount >= 2) {
    svgLoaded = true;
    onSvgLoadCallbacks.forEach((cb) => cb());
  }
}

fetch("./assets/SVG/number-0-outter.svg")
  .then((resp) => resp.text())
  .then((svgText) => {
    const parser = new DOMParser();
    const svg = parser.parseFromString(svgText, "image/svg+xml");
    const path = svg.querySelector("path");
    dOutter = path ? path.getAttribute("d") : null;
    console.log("SVG outer path loaded:", dOutter ? "success" : "failed");
    checkAllLoaded();
  })
  .catch((error) => console.error("Error loading outer SVG:", error));

fetch("./assets/SVG/number-0-inner.svg")
  .then((resp) => resp.text())
  .then((svgText) => {
    const parser = new DOMParser();
    const svg = parser.parseFromString(svgText, "image/svg+xml");
    const path = svg.querySelector("path");
    dInner = path ? path.getAttribute("d") : null;
    console.log("SVG inner path loaded:", dInner ? "success" : "failed");
    checkAllLoaded();
  })
  .catch((error) => console.error("Error loading inner SVG:", error));

export { dOutter, dInner, onSvgLoad };
