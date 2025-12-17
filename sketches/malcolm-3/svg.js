let d = null;

fetch("./assets/SVG/number-3-2.svg")
  .then((resp) => resp.text())
  .then((svgText) => {
    const parser = new DOMParser();
    const svg = parser.parseFromString(svgText, "image/svg+xml");
    const path = svg.querySelector("path");
    d = path ? path.getAttribute("d") : null;
    console.log("SVG path loaded:", d ? "success" : "failed");
  })
  .catch((error) => console.error("Error loading SVG:", error));

export { d };
