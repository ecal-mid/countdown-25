let d = null;
let svgLoaded = false;
let onSvgLoadCallbacks = [];

function onSvgLoad(callback) {
  if (svgLoaded) {
    callback();
  } else {
    onSvgLoadCallbacks.push(callback);
  }
}

fetch("./assets/SVG/number-1.svg")
  .then((resp) => resp.text())
  .then((svgText) => {
    const parser = new DOMParser();
    const svg = parser.parseFromString(svgText, "image/svg+xml");
    const path = svg.querySelector("path");
    d = path ? path.getAttribute("d") : null;
    console.log("SVG path loaded:", d ? "success" : "failed");
    svgLoaded = true;
    onSvgLoadCallbacks.forEach((cb) => cb());
  })
  .catch((error) => console.error("Error loading SVG:", error));

export { d, onSvgLoad };
