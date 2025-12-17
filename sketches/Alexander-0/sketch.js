import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Variables principales
let centerX, centerY;
let swabX = -2000,
  swabY = -2000;
let swabRotation = 0;
let swabVY = 0;
let swabRotSpeed = 0;

// Rotation au clic (90° uniquement)
let isFlipping = false;
let flipStart = 0;
let flipFrom = 0;
let flipTo = 0;
const FLIP_DURATION = 0.625;
let currentDirection = 1; // Direction actuelle (1 = horaire, -1 = anti-horaire)
let rotationsInCurrentDirection = 0; // Compteur de rotations dans la direction actuelle
let prevPressed = false; // Pour détecter le front montant du clic
let queuedRotation = false; // Rotation en attente (max 1)

// Système de saturation des cotons (3 niveaux)
let cottonCleanPercent = [0, 0]; // [TOP, BOTTOM] - pourcentage nettoyé par chaque coton
let cottonDirtyLevel = [0, 0]; // [TOP, BOTTOM] - niveau de saleté: 0=propre, 1=petite tache, 2=grosse tache, 3=presque plein, 4=100% sale
const LEVEL_THRESHOLDS = [0.15, 0.3, 0.45, 0.5]; // Seuils pour chaque niveau

// Timing et état
let time = 0;
let fadeIn = 0;
let fadeOut = 0;
let cleanTime = -1;
let finishCalled = false;
let fall = false;
let bothCottonsFull = false;

canvas.style.cursor = "none";

const TWO_PI = Math.PI * 2;

// Configuration du coton-tige
const SWAB_SCALE = 3.4;
// SWAB_PIVOT = centre de rotation du coton-tige (en coordonnées SVG viewBox 200x250)
// Le curseur sera exactement à ce point. Ajuste x/y pour déplacer le pivot.
const SWAB_PIVOT = { x: 100, y: 125 }; // Centre du bâtonnet
const COTTON_TOP = { x: 100, y: 10, radius: 10 };
const COTTON_BOTTOM = { x: 200, y: 140, radius: 10 };

// Debug et ajustements Chrome: active les marqueurs et ajuste l'alignement des zones
// dx/dy s'expriment dans le repère SVG (avant rotation), en unités du viewBox
// radiusMul permet d'élargir/réduire le rayon effectif de détection
const DEBUG_MARKERS = false; // mets à true pour afficher les marqueurs
const DETECT_TWEAK_SVG = {
  top: { dx: -85, dy: 5, radiusMul: 1.3 },
  bottom: { dx: -14, dy: 96, radiusMul: 1.3 },
};

// Décalage VISUEL du coton-tige par rapport au curseur (n'affecte PAS la détection)
// Utile si le centre du curseur ne correspond pas exactement au pivot visuel du batonnet
const VISUAL_SWAB_OFFSET = { dx: 170, dy: -170 };

// AJUSTEMENT MANUEL des taches de cérumen (en unités SVG, avant scale)
// Change ces valeurs pour déplacer les taches par rapport aux marqueurs rouges
// radiusMul: multiplicateur de taille (1.0 = taille normale, 0.5 = moitié, 2.0 = double)
const STAIN_OFFSET = {
  top: { dx: 0, dy: 0, radiusMul: 0.7 }, // Décalage pour le coton du haut
  bottom: { dx: 0, dy: 0, radiusMul: 0.7 }, // Décalage pour le coton du bas
};

// Chargement des SVG
const svgImages = { earwax: null, ear: null, swab: null, loaded: 0 };

function loadSVG(key, svgString) {
  const img = new Image();
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    svgImages[key] = img;
    svgImages.loaded++;
    if (svgImages.loaded === 3) console.log("All SVGs loaded");
  };
  img.src = url;
}

const earwaxSVG = `<?xml version="1.0" encoding="UTF-8"?><svg id="Calque_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 113.62 194.73"><path d="M36.15,9.83c-7.73.92-9.85,9.05-13.12,15.02-4.62,8.44-5.11,17.96-7.82,27.11-1.42,4.79,5.11,7.07,7.72,3.26,3.51-5.12,4.74-11.45,6.34-17.34.94-3.46,1.71-7.2,3.18-10.48,1.31-2.92,2.65-5.09,2.69-8.42.08-5.44-8.35-5.44-8.45,0-.15,7.96-4.56,15.27-7.49,22.51-1.99,4.94-5.58,11.9-3.97,17.36,1.08,3.64,5.71,3.98,7.72,1.01,3.72-5.48,4.47-12.27,7.86-17.99s4.54-11.56,6.32-17.74c1.2-4.14,5.21-9.17.83-12.95s-8.69-.33-11.86,2.83c-8.27,8.23-10.7,20.9-13.51,31.79-1.2,4.66-2.02,9.55-2.95,14.28-.81,4.11-.89,8.88,3.33,11.11,1.74.92,3.67.64,5.12-.66,2.97-2.67,4.06-6.56,5.19-10.26,1.45-4.74,4.28-8.72,6.17-13.27s2.33-10,3.77-14.92c.8-2.74,1.4-5.33,1.85-8.14.48-3.06,1.77-5.76,2.52-8.75,1.32-5.28-6.82-7.53-8.15-2.25-.58,2.32-1.63,4.49-2.18,6.81-.6,2.5-.71,5.06-1.39,7.56-1.34,4.92-2.13,10.09-3.62,14.96-1.28,4.22-4.14,7.77-5.79,11.83-1.34,3.3-1.6,7.99-4.33,10.45l5.12-.66c.75.4.09.18.39-.6.23-.61.26-1.39.4-2.03.29-1.28.72-2.52,1-3.8.86-3.97,1.26-7.92,2.4-11.85,2.23-7.68,3.54-16.53,8.41-23.1.66-.89,4.03-3.33,4.15-4.27l-2.45-2.5-.53,1.05c-.39.35-.65,1.21-.86,1.7-1.71,3.93-2.27,8.29-3.54,12.37-1.35,4.34-4.08,7.81-5.91,11.93-1.83,4.12-2.39,8.92-5.04,12.82l7.72,1.01c-.57-1.92,1.08-4.97,1.7-6.76,1.32-3.81,2.83-7.52,4.38-11.24,2.74-6.56,5.53-12.4,5.67-19.63h-8.45c-.04,2.74-2.25,5.48-3.13,8.08-.95,2.8-1.67,5.72-2.45,8.58-1.41,5.21-2.39,10.8-5.49,15.32l7.72,3.26c1.94-6.57,2.35-13.8,4.58-20.21,1.15-3.33,3.29-6.34,4.9-9.47.47-.91,2.31-6.14,3.32-6.26,5.33-.64,5.4-9.1,0-8.45h.01Z" style="fill:#fcc00d;"/><path d="M45.18,100.22c1,2.84,3.29,5.73-.66,6.99-2.54.81-4.74,1.09-7,2.81-.78.59-1.43,1.29-2.17,1.92-1.42,1.22-1.66,1.8-2.64-.07-.13-.25-.19-2.88-.43-2.94-2.03-.49-.22,5.12,0,5.73,2.14,5.68,8.91,4.52,12.13.65.71-.86,1.81-2.61,2.22-2.98.76-.66,1.74-.9,2.48-1.5,1.06-.85,1.79-1.6,2.27-2.91.16-.45.71-3.46.04-3.01,3.82-2.53,1.53-9.23-3.26-7.72-3.09.97-4.62,2.53-5.95,5.45-1.21,2.66-.43,1.28-3.17,1.12-1.8-.10-3.41.38-5.16.72-2.2.43,2.54.1-.91.10-.54,0-1.07-.17-1.62-.14-1.48.08-2.61.87-3.74,1.75-2.97,2.3-4.74,5.14-4.21,9,1.14,8.27,10.26,10.41,17.34,10.07,3.26-.15,7.01-1.71,7.73-5.23.58-2.82-.73-6.28-3.21-7.69-4.73-2.7-8.99,4.6-4.26,7.3l.58.33-1.94-2.52c.28.81.48,1.34.46,2.03l1.24-2.99c-1.13,1.22-6.08.02-7.52-.57-3.22-1.32-1.58-2.62.51-4.27l-2.99,1.24c-2.82.05.08.19.91.29,1.24.14,2.14-.16,3.31-.43,2.83-.64,5.07.52,7.82.05,2-.34,3.59-1.71,4.77-3.29.65-.87,1.39-2,1.63-3.08.18-.4.34-.81.48-1.23-.84.45-.8.5.14.14l-3.26-7.72c-3.14,2.08-3.99,5.55-4.07,9.19l1.24-2.99c-.79.93-2.67,1.44-3.64,2.39-.56.54-2.01,2.23-2.24,2.96l-.75,1.08c1.94.95,2.73.82,2.39-.39,1-3.81-5.14-6.95-7.9-7.13-8.81-.6-10.61,8.79-5.74,14.79,2.45,3.02,6.27,5.11,10.19,3.69,3.52-1.28,5.26-4.57,8.94-5.51,3.14-.8,6.55-2.21,8.49-5.05,2.98-4.37.75-8.38-.75-12.66-1.79-5.1-9.96-2.9-8.15,2.25h0l.02-.02h.01Z" style="fill:#fcc00d;"/><path d="M45.1,184.05c-1.1-.68-2.31-.92-3.46-1.44-1.06-.49-2.03-1.35-3-1.99-1.05-.7-2.10-1.39-3.15-2.08-.42-.28-.83-.60-1.26-.87-.78-.48-1.59-.45-2.46-.52-2.54-.2-3.32,3.48-1.26,4.66,1.62.93,3.15,2,4.69,3.06s2.85,2.19,4.68,2.46c1.48.22,3.15.68,4.78.65,2.34-.04,3.57-1.93,3.6-4.13.03-2.02-1.78-3.45-3.56-4.02-.88-.28-1.8-.14-2.54-.09-.81.06-1.82.35-2.36.35-1.47,0-3.09-.35-4.37-1.08-.38-.21-.73-.46-1.10-.68s-.99-.79-.47-.03c.66.98-.07-.60-.15-.75-.26-.45-.59-.76-.97-1.10-.76-.68-1.48-1.45-2.39-1.95-1.66-.91-3.85-.63-4.61,1.32-.94,2.4.74,4.13,2.58,5.34.69.45,1.36,1.02,2.17,1.24,1.22.33,2.41-.19,3.27-1.05,1.52-1.5,1.49-3.81.63-5.64-.7-1.49-2.57-2.76-4.14-3.23-2.10-.62-3.8.64-4.97,2.24s-2.09,3.17-1.13,5.10c.83,1.68,2.87,3.15,4.44,4.08.51.30,1.07.56,1.66.69.44.10.90.07,1.33.22.76.26,1.42.93,2.16,1.30,2.07,1.03,4.25.20,6.40.41.93.09,1.87.46,2.78.70.46.12.54.14.79.26.28.12.54.29.84.38.12.04.67.28.31.05,1.14.73,2.76.23,3.42-.90.71-1.21.24-2.69-.90-3.42-.32-.21-.67-.33-1.04-.45-.49-.16.12.08-.33-.12-.70-.31-1.36-.51-2.10-.71-1.48-.40-2.95-.85-4.50-.78-.71.03-1.41.11-2.12.12-.38,0-1.10.08-1.33,0-.45-.15-1.01-.70-1.47-.96-.65-.36-1.36-.67-2.09-.81-.67-.13-.95-.08-1.44-.37s-.90-.64-1.32-1c-.24-.21-.49-.42-.73-.63-.10-.09-.43-.33-.33-.33-.26,1.24-.25,1.62,0,1.13.07-.12.15-.24.24-.35.15-.22.31-.43.46-.65.48-.69-.22.37.25-.34.21-.31.19-.06-.12-.06l-.63-.02c-.16-.07-.11-.03.15.11.20.18.52.29.74.44.26.17.21.03.38.28-.07-.10-.18-.33-.13-.07.15.85-.03-.06.23-.19l1.26-.34c.75.31.92.34.49.08-.17-.12-.35-.24-.52-.35-.34-.22-.75-.60-1.12-.74.02.04.04.08.06.12-2.68,1.25-3.42,2.03-2.23,2.33-.34-.15-.38-.15-.13,0,.11.07.22.15.33.23-.47-.34.19.19.27.26.16.14.31.30.47.44.09.09.44.48.52.45-.29-.56-.38-.66-.27-.28.09.27.20.53.32.79.49.88,1.36,1.35,2.19,1.84s1.67,1.01,2.61,1.39c1.73.71,3.82,1.11,5.70,1.04.52-.02,1.02-.15,1.52-.27.30-.07.38-.07.82-.11.33-.04.66-.08.99-.15-.06.04-.13.05-.20.03-.18-.07.49.34.60.39.58.40.39.02-.57-1.14-.02.28-.02.32,0,.11,1.68-.71,2.11-1.04,1.29-.99-.16,0-.33-.02-.49-.04-.67-.06-1.24-.13-1.88-.27-.79-.17-1.54-.16-2.12-.50-.75-.45-1.46-1.02-2.18-1.52-1.59-1.09-3.16-2.20-4.84-3.16l-1.26,4.66c.40.07.45.05.14-.07-.23-.13-.26-.13-.10-.02.13.17.40.29.57.41.49.33.98.65,1.47.97.96.64,1.93,1.26,2.88,1.91,1.05.72,2.06,1.50,3.26,1.96,1.05.40,1.67.50,2.59,1.06,2.75,1.70,5.26-2.63,2.52-4.32h0l-.02.03h0Z" style="fill:#fcc00d;"/><path d="M71.37,192.39c3.93.02,7.74-.37,9.98-4.08,1.63-2.71.93-6.69-1.37-8.91-2.14-2.07-6.08-2.34-8.70-1.20-1.36.59-5.42,5.93-5.83,5.85l3.10,4.07c-.10-1.58-.27-3.15-.43-4.68-.06-.60.23-1.77-.14-2.31l-.63.88c-1.24-1.25-1.59-1.43-1.04-.54.77,3.91,6.90,3.94,9.69,3.83,5.44-.22,5.43-8.18,0-8.45-2.11-.11-3.76-.67-5.39-2.05l-2.99,7.21c1.39.03,3.75,2.37,5.10,1.82l1.29-2.95c-.53.10-1.03.27-1.52.50-.86.18-1.67.90-2.39,1.32-3.30,1.95-10.20,4.23-14.04,3.70l2.52,6.21c1.03-1.46,2.65-1.88,4.01-2.99s1.68-2.39,2.71-3.59c3.52-4.11-2.43-10.11-5.98-5.98-1.51,1.76-2.08,2.87-4.08,4.11-1.75,1.08-2.78,2.51-3.95,4.18-1.43,2.04-.08,5.85,2.52,6.21,4.80.66,9.10-.65,13.74-1.80,2.04-.51,4.10-1.02,5.93-2.10,1.65-.98,3.67-1.65,5.20-2.75,3.26-2.33,3.07-6.77.62-9.59s-8.14-4.67-11.68-4.75-5.83,4.81-2.99,7.21c3.40,2.87,6.91,4.30,11.37,4.52v-8.45c-2.27.09-1.83.13-3.23-1-.95-.77-1.21-1.44-2.39-1.98-2.26-1.03-5.10-.38-7.25.71-5.34,2.70-3.31,8.79-3.02,13.54.11,1.74,1.23,3.72,3.10,4.07,3.92.74,6.55-.90,9.34-3.55.95-.91,2.25-1.92,2.89-3.08.87-1.58-.54.59-.92.46-1.98-.69-.45-2.07-3.14-2.09-5.44-.03-5.44,8.42,0,8.45h0v.02h-.01Z" style="fill:#fcc00d;"/><path d="M15.69,122.63c-.19-1.10-.63-1.94-.93-3.01l-.43,3.26c-2.47-.04-2.98.22-1.53.77-1.28.07-1.35-.49-.21-1.66-.98-.10-2.93,2.68-3.47,3.27l7.06,1.86c-.50-3.35-.59-8.90-4.79-9.63-2.05-.36-3.56.30-4.77,1.94-2.51,3.42-.24,7.92.50,11.49.91,4.38,1.78,9.01,3.52,13.16,1.63,3.89,8.96,4.10,8.30-1.12-.36-2.83-1.38-6.05-2.90-8.49-1.40-2.26-4.71-2.87-6.64-.86-4.31,4.49-.10,7.61.19,12.38l8.30-1.12c-1.40-7-3.59-13.31-3.37-20.60H6.07c.31,9.54,4.36,18.73,4.83,28.32.26,5.40,8.46,5.47,8.45,0,0-2.83-.61-6.20-.28-8.99l-1.24,2.99.44-.48-2.99,1.24.94-.04c5.05-.21,5.36-6.52,1.12-8.30l-.92-.39,2.52,1.94c-.61-1.43-1.28-2.74-1.99-4.13-2.49-4.93-9.45-.61-7.30,4.26.72,1.63,1.66,3.26,2.55,4.80.07.11,2.63,3.37,2.60,2.43l2.09-3.65c1-.23,1.02-.27.06-.13-1.38.16-3.03.66-3.65,2.09-.48,1.12-1.45,2.33-2.38,3.12-3.82,3.27,1.04,8.69,5.12,6.64.74-.37,1.29-.83,1.90-1.39.44-.40,1.95-1.85.16-.53h-4.26l-.22-.20-.43-3.26.79-1.25,2.99,1.24c-1.04-.97-1.81-6.99-1.22-9.26-2.57.34-5.15.67-7.72,1.01,1.03,1.58,1.41,3.47,2.54,4.99,1.04,1.40,2.93,2.04,2.92,3.88,0,1.99,1.34,3.42,3.10,4.07l.47.18c5.10,1.90,7.31-6.26,2.25-8.15l-.47-.18,3.10,4.07c0-2.50-.50-4.62-2.10-6.60-1.80-2.22-2.95-4.12-4.51-6.54-1.92-2.96-6.77-2.64-7.72,1.01-1.26,4.83-.73,16.77,5.26,18.57,6.75,2.02,11.99-7.13,5.25-10.89-1.22-.68-3.06-.88-4.26,0-.65.48-1.44,1.61-2.06,1.92l5.12,6.64c1.53-1.31,2.90-2.99,3.70-4.83l-3.65,2.09c3.58-.42,6.97-1.68,6.20-6.17-.39-2.26-1.85-2.87-3.10-4.53-1.13-1.49-2.32-3.71-3.10-5.47l-7.30,4.26c1.53,3.03,2.17,5.09,5.43,6.46.37-2.77.75-5.53,1.12-8.30-7.59.31-5.33,8.56-5.33,13.73h8.45c-.24-4.91-1.39-9.77-2.25-14.59-.81-4.55-2.43-9.12-2.58-13.73-.18-5.43-8.29-5.45-8.45,0-.24,8.04,2.12,15.11,3.67,22.85.93,4.64,8.58,3.63,8.30-1.12-.10-1.67-.24-3.32-.83-4.90-.27-.76-.63-1.47-1.08-2.14-.44-1.23-.70-1.02-.76.63l-6.64-.86c.58.93,1.60,3.11,1.75,4.23,2.77-.37,5.53-.75,8.30-1.12-1.34-3.18-2.13-6.71-2.89-10.07-.36-1.62-.44-3.35-.86-4.95-.37-.85-.71-1.70-1.03-2.57,0-1.30-.02-1.48-.09-.55l-4.77,1.94.57.10-2.52-1.94c-.79-1.82-.17,1.64-.12,1.85.29,1.30.76,2.38.96,3.72.47,3.14,5.09,4.05,7.06,1.86,2.15-2.37,4.91-3.83,5.18-7.29.24-3.16-.84-6.14-3.58-7.79-2.41-1.45-5.29-1.73-7.69-.04-3.46,2.43-2.03,5.42-1.47,8.75.90,5.35,9.04,3.08,8.15-2.25h0l.02.05h0Z" style="fill:#fcc00d;"/><path d="M78.94,4.40c-1.19-1.52-2.82-2.63-4.36-3.79s-3.88-.53-5.12.66c-9.44,9.02,8.72,13.09,13.07,16.88l5.12-6.64c-2.32-1.27-4.26-3.21-6.36-4.79-1.52-1.15-3.66-1.76-4.93-3.18l-2.99,7.21c4.15-.35,9.90,5.25,12.39,8.02,1.70,1.90,2.91,4.01,4.04,6.28.45.90.86,1.82,1.31,2.72.58,1.19.74,2.72,1.64,1.18l2.52-1.94c-3.73.86-3.71-5.86-5.22-8-.96-1.36-2.44-2.37-4.10-2.67-.80-.14-1.45-.10-2.25,0,.18-.02-3,.82-2.76.94l1.94,2.52c-2.02-6.69-4.29-12.86-10.87-16.07-4.87-2.38-9.16,4.91-4.26,7.30,2.81,1.37,3.38,2.26,4.56,5.04.77,1.81,1.48,3.68,2.26,5.44,1.39,3.13,5.35,5.70,8.94,3.64,1.82-1.04-.02-1.25-.36-.61-.24.45.45,2.02.59,2.46.60,1.87,1.40,3.59,2.84,4.96,2.26,2.14,6.79,3.95,9.92,3.43,9.08-1.49,1.26-13.94-1.21-17.93-3.93-6.34-13.71-15.86-21.93-15.17-3.68.31-5.53,4.37-2.99,7.21,1.64,1.83,4.15,2.95,6.11,4.36,2.28,1.64,4.42,3.58,6.89,4.93,4.05,2.23,8.87-3.37,5.12-6.64-4.28-3.73-10.17-5.58-14.95-8.62l1.94,2.52-.07,1.17-5.12.66c.86.65,2,1.64,2.65,2.47,3.35,4.28,9.29-1.74,5.98-5.98h0s.02.03.02.03Z" style="fill:#fcc00d;"/><path d="M9.58,91.20c-.07-2.22,2.77-3.42,4.64-4.01,1.14-.36,2.20-.36,3.38-.44.47-.03.93,0,1.38.11-.39,0-.64-.17-.74-.48l2.09-3.65c1.26-.74-.08-.26-.73-.19-.92.11-1.55.24-2.34.73-1.44.91-2.74,3-3.28,4.59-.63,1.85-1,4.24-.89,6.18.04.82.15,2.44.72,3.14,3.99.99,5.58.35,4.76-1.91-.14-.46-.25-.92-.33-1.40-.31-2.07.09-3.77-1.40-5.54s-3.35-1.93-5.42-2.24-3.80-.28-5.36,1.29c-.69.70-1.07,1.45-1.38,2.37-.13.32-.20.65-.22,1-.57,1.57.11,1.78,2.03.64l1.94,2.52c-.30-.99.02-2.80.02-3.83C8.45,84.64,0,84.63,0,90.08c0,4.10-.21,9.76,5.55,9.43,2.35-.14,4.76-1.39,6.06-3.38.52-.80,1.04-2,1-2.99.04-.28.08-.56.11-.84-3.53,1.29-4.23,2.04-2.12,2.24,1.96.51,1.68-.15-.82-1.99l-.06.94c-.23,1.28.42,2.80.70,4.02.49,2.14,1,4.11,3.16,5.18,4.05,2.01,8.72-.76,8.72-5.24,0-2.25-1.23-4.17-.41-6.43.13-.60.42-1.11.86-1.55-3.02,1.05-3.62,1.55-1.78,1.49,1.06.07,2.04-.13,2.99-.59,4.40-2.15,2.85-8.42-.58-10.72-3.89-2.61-10.14-1.44-14.08.41-4.78,2.25-8.37,5.60-8.18,11.13s8.63,5.45,8.45,0h0Z" style="fill:#fcc00d;"/><path d="M64.07,133.79c-.10-5.90.99-11.08,3.97-16.29,2.36-4.11,5.72-7.41,7.58-11.83,4.34-10.31,7.58-20.71,12.88-30.65,2.67-5.01,9.39-17.08,1.06-20.77-5.95-2.63-8.37,5.20-10.93,8.72l4.77-1.94-.54-.18,2.52,1.94c-.36-.49-.35-2.05-.12-2.62-.95.69-1,.96-.14.81,1.55.17,1.78-1.01.69-3.54-.70-.55-8.19,2.38-9.06,2.88-5.52,3.14-3.31,12.96-3.31,18.16s8.45,5.45,8.45,0-1.14-12.15,1.52-17.16c2.55-4.79-4.52-8.97-7.30-4.26-2.59,4.39-5.18,10.12-6.25,15.11s-.44,10.83-.45,16.10c0,2.90.33,5.99,0,8.88-.23,2.06-1.57,3.10-2.12,5.03-1.50,5.30,2.44,10.66.45,16.02-.81,2.18-2.68,3.46-3.75,5.46-1.19,2.23-1.77,4.95-2.65,7.31-1.76,4.71-4.73,7.94-5.48,13.03-.45,3.06.32.78-.44,2.39-.13.29-1.94,1.55-1.21,2.05.61.41,3.91-2.49,4.40-3.04,3.18-3.61,2.45-8.52,3.59-12.80,1.41-5.26-6.74-7.50-8.15-2.25-.72,2.70-.02,7.31-1.82,9.44-1.51,1.78-3.94,2.07-5.30,4.29-2.33,3.80-1,9.12,3.05,11.05,4.46,2.13,9.31.08,12.17-3.62,1.98-2.56,1.51-4.48,2.16-7.51s3.15-5.65,4.36-8.60c1.10-2.67,1.61-5.83,3.16-8.24s3.15-3.89,4.06-6.71c1.07-3.33,1.09-6.55.57-9.97-.25-1.65-.82-3.32-.82-4.99.06-1.19-.03-1.35-.27-.48.49-.60.94-1.22,1.35-1.87,1.29-2.42,1.14-5.32,1.15-7.96,0-3.94.05-7.89.02-11.84-.03-3.49-.46-7.12.55-10.51,1.07-3.61,3.06-8.24,4.99-11.50l-7.30-4.26c-3.66,6.88-2.67,13.79-2.67,21.42h8.45v-6.72c0-1.16-.54-3.72-.09-4.81-1.21.95-.85.98,1.08.07,1.19-.22,2.37-.50,3.53-.82.94-.29,1.90-.59,2.78-1.03,4.96-2.44,5.95-9.27.36-11.85-4.60-2.13-10.94-.52-12.39,4.64-1.15,4.10-.57,9.73,4,11.23,1.91.63,3.69-.46,4.77-1.94.59-.81,3.05-4.21,2.90-5.03.75-.79.16-1.02-1.78-.70-1.96-1-2.67-.48-2.14,1.56-.87,1.48-1.51,3.16-2.23,4.73-3.55,7.74-7.45,15.09-10.53,23.06-1.43,3.69-2.54,7.57-4.10,11.20-1.44,3.35-3.97,6.04-5.98,9.06-4.57,6.86-6.58,14.53-6.44,22.67.09,5.43,8.54,5.45,8.45,0h0l-.03-.02h0Z" style="fill:#fcc00d;"/><path d="M57.94,28.12c2.37-.13,6.26,2.61,8.14,4.13,2.54,2.05,5.58,6.31,5.21,9.67l3.10-4.07c-3.56.61-8.53-11.55-10.12-14.03s-2.89-5.23-5.73-6.60c-2.36-1.14-7.02-1.48-9.44-.42-6.15,2.70-2.39,11.29,1.02,14.65,1.09,1.07,2.36,1.91,3.82,2.38,1.03.33,2.89.19,3.64.59s1.98,2.43,2.88,3.18c1.58,1.33,3.43,2.17,5.08,3.40,4.36,3.25,8.58-4.08,4.26-7.30-2.43-1.81-4.17-3.17-6.26-5.34-1.61-1.67-3.37-1.73-5.42-2.40-1.51-.49-2.27-.68-3.13-2.07-.35-.62-.61-1.27-.79-1.96l-1.23,2.88c.21.30,2.16.56,2.79,1.22.86.89,1.64,2.58,2.32,3.66,4.55,7.20,7.95,18.13,18.54,16.31,1.96-.34,2.91-2.34,3.10-4.07.59-5.33-3.41-11.55-7.09-15.07-3.69-3.53-9.48-7.45-14.70-7.18s-5.44,8.74,0,8.45h.01Z" style="fill:#fcc00d;"/><path d="M84.81,161.63c-.16,2.91-.61,6.40,1.61,8.73s5.21,2.01,7.64.44c5.82-3.74,5.34-12.27-2.67-11.99-3.21.12-6.29,1.70-7.39,4.89-.85,2.47-1.38,7.43.40,9.55,5.28,6.31,13.24-1.77,13.91-7.50.93-7.90-8.70-11.44-13.78-5.51-3.99,4.66-4.63,17.19,4.11,16.63,3.31-.21,6.57-2.91,7.94-5.85.95-2.04.95-4.36,1.40-6.53.65-3.14,2.10-5.38,3.56-8.14.89-1.69,1.31-3.65,2.29-5.28,1.30-2.17,3.37-3.77,5.16-5.49,2.90-2.80,4.58-5.18,4.62-9.27.04-3.60.06-7.47-4.01-8.81-3.05-1-7.16-.18-8.87,2.71-.87,1.47-.89,3.12-.97,4.76-.12,2.68-.28,5.25-.91,7.91-.75,3.18-2.03,5.84-4.01,8.43-.58.77-1.12,1.54-1.65,2.34-.46.80-.95,1.58-1.46,2.35.61-.65.35-.70-.75-.17l4.77,1.94c-.02,1.04.08.95.30-.26.14-.48.27-.97.36-1.46.38-1.52.75-2.96,1.41-4.39,1.40-3.04,2.75-5.30,2.76-8.74,0-2.93-.70-5.54-1.65-8.27-1.24-3.56-1.24-7.06-1.04-10.82.08-1.50.19-3.41,1.14-4.69.26-.86.89-1.38,1.88-1.57-.57-2.08-.65-2.28-.25-.58.44,3.74-1.34,7.51-3.39,10.66-3.53,5.44-7.51,9.84-4.94,16.66,1.06,2.81,4.73,4.38,7.06,1.86,4.96-5.35,3.30-13.98,4.03-20.53.30-2.69.18-5.24-2.27-6.89-2.32-1.56-5.82-1.22-7.72.87-2.01,2.20-1.51,6.10-1.77,8.84-.31,3.23-.17,6.34-.78,9.56-.74,3.90-1.92,7.85-2.34,11.79-.38,3.52-.21,7.13-1.02,10.60l8.30,1.12c.05-6.42-1.16-12.36.55-18.74,1.50-5.58,5.25-10.20,2.84-15.95-.91-2.19-2.73-3.51-5.20-2.95-6.61,1.49-4.56,14.76-4.55,19.39.01,5.48,8.13,5.39,8.45,0-1.20,1.36-1.20,1.65.01.88.47-.22.89-.49,1.28-.83.93-.73,1.42-1.54,2.07-2.48.97-1.39,2.22-2.95,3.04-4.48,2.82-5.26.69-11.73,1.44-17.35l-5.35,4.07c1.45.25,3.35,6.15,3.61,7.07.62,2.17,1.79,9.92-2.02,10.08-5.42.22-5.45,8.67,0,8.45,8.75-.35,11.63-8.78,10.93-16.45-.51-5.53-3.77-16.19-10.28-17.29-2.97-.50-4.96,1.17-5.35,4.07-.65,4.89,1.45,10.65-1.72,14.65-.59.74-.95,1.66-1.50,2.36-.73.93-1.14.95-2.01,1.75-1.84,1.70-2.47,2.97-2.62,5.50h8.45c0-2.88-.05-5.77,0-8.65.02-1.21-.26-3.44.48-4.45l-2.52,1.94.39-.09-5.20-2.95c1.14,2.73-.66,4.70-1.63,7.30s-1.65,5.19-2.06,7.79c-.94,5.88.05,11.51,0,17.35-.04,4.69,7.19,5.83,8.30,1.12,1.53-6.52,1.57-13.30,2.88-19.89.62-3.13,1.35-6.29,1.44-9.49.09-2.97-.23-6.68.50-9.55l-1.94,2.52c-2.58-2.55-3.84-2.72-3.77-.51l-.13,1.37c-.11,1.96.07,3.95.05,5.91-.01,1.59-.34,6.15-1.28,7.17l7.06,1.86c-1.71-4.52,3.77-9.22,5.69-13.12,2.21-4.51,3.76-8.34,2.78-13.41-.64-3.28-1.99-6.42-5.66-7.02s-8.43,1.98-10.57,4.72c-5.26,6.72-3.87,17.56-1.45,25,1.82,5.60-1.33,8.99-2.69,14.18-.80,3.05-2.22,6.80-.13,9.61,1.15,1.55,2.81,2.45,4.77,1.94,2.72-.70,4.16-1.52,5.80-3.71,2.09-2.77,4.41-5.95,5.84-9.12,1.77-3.94,2.72-8.03,3.18-12.32.10-.96.31-1.90.21-2.87-.05-.65-.06-1.30-.05-1.95-1.97,1.13-2.38,1.67-1.24,1.61l-1.94-2.52c1.13,3.93-1.32,5.69-3.83,8.14-3.18,3.10-4.75,6.11-6.60,10.05s-4.12,7.31-4.90,11.85c-.16.91-.67,2.24-.54,3.16s.59,2.63,1.27,1.36c.54-1.01-.66-2.34-.65-2.33.06.04-.58,1.43-.94,1.31l2.52,1.94-.28-.54.43,3.26c.57-2.88.72-3.49-.48-6.11-2.68-5.87-.66,2.55,2.04-.68.35-.42.15-2.32.18-2.84.29-5.43-8.16-5.42-8.45,0h.04,0Z" style="fill:#fcc00d;"/></svg>`;

const earSVG = `<?xml version="1.0" encoding="UTF-8"?><svg id="Calque_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 161.16 239.46"><defs><linearGradient id="Dégradé_sans_nom_361" x1="109.23" y1="35.48" x2="109.23" y2="220.39" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6e6e6d"/><stop offset="1" stop-color="#f1dfc5"/></linearGradient><linearGradient id="Dégradé_sans_nom_434" x1="23.63" y1="85.82" x2="128.66" y2="146.45" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4e4d4c"/><stop offset="1" stop-color="#f1dfc5"/></linearGradient></defs><path d="M78.94,220.39s61.44-7.48,60.57-85.44c-.86-77.97-16.67-99.47-16.67-99.47l-43.91,184.91Z" style="fill:url(#Dégradé_sans_nom_361); stroke:#010101; stroke-miterlimit:10;"/><path d="M145.10,37.62c10.38,19.13,15.56,45.34,15.56,78.62,0,31.56-4.70,57.66-14.10,78.30-13.62,29.61-35.88,44.42-66.79,44.42-27.88,0-48.63-12.10-62.25-36.31C6.17,182.44.50,155.31.50,121.27c0-26.37,3.40-49.01,10.21-67.92C23.46,18.12,46.54.50,79.93.50c30.04,0,51.77,12.38,65.17,37.12ZM115.74,192.28c8.98-13.40,13.48-38.36,13.48-74.89,0-26.37-3.25-48.07-9.74-65.09-6.50-17.02-19.11-25.53-37.83-25.53-17.21,0-29.80,8.08-37.75,24.24-7.96,16.16-11.94,39.96-11.94,71.41,0,23.67,2.54,42.69,7.63,57.06,7.79,21.94,21.11,32.91,39.94,32.91,15.15,0,27.22-6.70,36.21-20.10Z" style="fill:#f1dfc5; stroke:#010101; stroke-miterlimit:10;"/><path d="M79.53,212.38s-36.78,3.76-44.70-51.67c-7.82-54.69-1.01-93.10,9.06-109.71,16.49-27.17,51.93-4.64,57.15,10.11,11.20,31.66-24.15,102.36-24.15,102.36,0,0-10.75,17.81,2.71,34.83,2.49,3.15,3.45,7.53,1.53,11.05-.95,1.74-3.80,5.96-19.90-1.30-4.49-2.87-6.25-2.50-13.28-11.59-1.84-2.38-3.32-4.60-4.30-6.68-2.31-4.90-1.62-13.83,6.36-20.81,12.04-10.53-3.19-30.98-3.19-30.98,0,0-28.52-30.86-6.04-32.69,0,0,11.21-.02,12.04,17.05,0,0,1.07,13.39,13.91,3.30,6.74-5.29-1.71-14.59-1.71-14.59,0,0-7.62-9.75-19.20-12.16-3.15-.90-11.47-3.04-11.64-12.88-.31-17.85,9.90-40.04,20.62-49.76,14.45-13.12,28.37-10.69,38.66-8.54,20.81,4.35,27.44,22.87,29.02,39.63,1.27,13.43-.70,26.96-5.29,39.65-5.75,15.93-15.58,46.44-13.23,63.41,3.27,23.68-12.03,41.51-24.42,41.98Z" style="fill:url(#Dégradé_sans_nom_434); stroke:#010101; stroke-miterlimit:10;"/></svg>`;

const swabSVG = `<?xml version="1.0" encoding="UTF-8"?><svg id="Calque_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200.22 249.94"><path d="M34.35,46.98l7.21-5.59c48.10,62.06,120.83,155.85,129.04,166.45,0,0-3.61,10.28-7.21,5.59-7.02-9.15-129.28-167.71-129.04-166.45h0Z" style="fill:#9ad5ed;"/><path d="M34.35,46.98L7.19,25.22c-2.33-1.87-4.94-5.18-6.03-7.95C-.39,13.35-1.39,7.30,4.95,2.88c8.02-5.59,13.69-1.81,16.79.94,2.28,2.02,5.17,5.59,6.98,9.53l12.82,28.03s-7.21,5.59-7.21,5.59Z" style="fill:#fff;"/><path d="M163.39,213.43l11.67,28.68c1.03,2.54,2.79,4.75,5.12,6.18,3.13,1.92,7.89,2.94,13.93-1.41,6.50-4.68,6.67-9.53,5.62-12.82-.65-2.05-1.96-3.83-3.63-5.20l-25.52-21.02-7.21,5.59h0Z" style="fill:#fff;"/></svg>`;

loadSVG("earwax", earwaxSVG);
loadSVG("ear", earSVG);
loadSVG("swab", swabSVG);

// Chargement des sons
const sounds = {
  turn: new Audio("./assets/turn.mp3"),
  cleaning: new Audio("./assets/nettoyage.mp3"),
};
sounds.turn.volume = 0.5;
sounds.cleaning.volume = 0.7;
sounds.cleaning.loop = false;

let earwaxMaskCanvas = null;
let earwaxMaskCtx = null;

function initEarwaxMask() {
  earwaxMaskCanvas = document.createElement("canvas");
  earwaxMaskCanvas.width = canvas.width;
  earwaxMaskCanvas.height = canvas.height;
  earwaxMaskCtx = earwaxMaskCanvas.getContext("2d");
  earwaxMaskCtx.fillStyle = "white";
  earwaxMaskCtx.fillRect(0, 0, earwaxMaskCanvas.width, earwaxMaskCanvas.height);
}

let initAttempts = 0;
const tryInit = setInterval(() => {
  initAttempts++;
  if (svgImages.loaded >= 3) {
    initEarwaxMask();
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    clearInterval(tryInit);
  } else if (initAttempts > 50) {
    clearInterval(tryInit);
  }
}, 100);

window.addEventListener("resize", () => {
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;
  initEarwaxMask();
});

function rotatePoint(x, y, angle, pivot) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - pivot.x;
  const dy = y - pivot.y;
  return {
    x: dx * cos - dy * sin + pivot.x,
    y: dx * sin + dy * cos + pivot.y,
  };
}

function getCottonCenters(x, y, scale, rotation) {
  const centers = [];
  const cottons = [COTTON_TOP, COTTON_BOTTOM];
  for (let cotton of cottons) {
    const rotated = rotatePoint(cotton.x, cotton.y, rotation, SWAB_PIVOT);
    centers.push({
      x: x + (rotated.x - SWAB_PIVOT.x) * scale,
      y: y + (rotated.y - SWAB_PIVOT.y) * scale,
    });
  }
  return centers; // [topCenter, bottomCenter]
}

function drawSwab(x, y, scale, rotation) {
  if (!svgImages.swab) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Dimensions du SVG viewBox
  const svgViewBoxWidth = 200.22;
  const svgViewBoxHeight = 249.94;

  // Calculer la taille finale et le pivot
  const finalWidth = svgViewBoxWidth * scale;
  const finalHeight = svgViewBoxHeight * scale;
  const pivotX = SWAB_PIVOT.x * scale;
  const pivotY = SWAB_PIVOT.y * scale;

  // Dessiner le coton-tige blanc avec taille explicite
  ctx.drawImage(svgImages.swab, -pivotX, -pivotY, finalWidth, finalHeight);

  // Fonction helper pour dessiner une forme organique
  const drawOrganicBlob = (cx, cy, radius, seed) => {
    ctx.beginPath();
    const points = 8; // Nombre de points de contrôle
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * TWO_PI;
      // Variation du rayon pour créer une forme irrégulière
      const variation =
        0.7 +
        Math.sin(angle * 3 + seed) * 0.2 +
        Math.cos(angle * 5 + seed * 1.3) * 0.1;
      const r = radius * variation;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Utiliser des courbes de Bézier pour des angles arrondis
        const prevAngle = ((i - 1) / points) * TWO_PI;
        const prevVariation =
          0.7 +
          Math.sin(prevAngle * 3 + seed) * 0.2 +
          Math.cos(prevAngle * 5 + seed * 1.3) * 0.1;
        const prevR = radius * prevVariation;
        const prevX = cx + Math.cos(prevAngle) * prevR;
        const prevY = cy + Math.sin(prevAngle) * prevR;

        // Points de contrôle pour courbe de Bézier quadratique
        const midAngle = (prevAngle + angle) / 2;
        const cpVariation =
          0.7 +
          Math.sin(midAngle * 3 + seed) * 0.2 +
          Math.cos(midAngle * 5 + seed * 1.3) * 0.1;
        const cpR = radius * cpVariation * 1.1;
        const cpX = cx + Math.cos(midAngle) * cpR;
        const cpY = cy + Math.sin(midAngle) * cpR;

        ctx.quadraticCurveTo(cpX, cpY, x, y);
      }
    }
    ctx.fill();
  };

  // Dessiner les taches jaunes organiques selon le niveau de saleté
  const cottons = [COTTON_TOP, COTTON_BOTTOM];
  ctx.fillStyle = "#fcc00d"; // Couleur du cérumen (jaune)

  cottons.forEach((cotton, index) => {
    const level = cottonDirtyLevel[index];
    const seed = index * 3.7; // Seed différent pour chaque coton

    // Récupérer les tweaks pour positionner les taches exactement sur les marqueurs
    const tweak = index === 0 ? DETECT_TWEAK_SVG.top : DETECT_TWEAK_SVG.bottom;
    const dx = tweak && typeof tweak.dx === "number" ? tweak.dx : 0;
    const dy = tweak && typeof tweak.dy === "number" ? tweak.dy : 0;
    const rMul =
      tweak && typeof tweak.radiusMul === "number" ? tweak.radiusMul : 1;

    // Récupérer l'offset manuel de tache pour ce coton
    const stainOffset = index === 0 ? STAIN_OFFSET.top : STAIN_OFFSET.bottom;
    const sdx = stainOffset.dx || 0;
    const sdy = stainOffset.dy || 0;
    const srMul = stainOffset.radiusMul || 1.0; // Multiplicateur de taille des taches

    if (level >= 1) {
      // Niveau 1: Petites taches organiques (15%)
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * TWO_PI + seed;
        const dist = cotton.radius * 0.5 * rMul * srMul;
        const size = cotton.radius * 0.4 * rMul * srMul;
        // Coordonnées SVG avec offsets + ajustement manuel, puis soustraire pivot, puis MULTIPLIER par scale
        const localX =
          (cotton.x + dx + sdx + Math.cos(angle) * dist - SWAB_PIVOT.x) * scale;
        const localY =
          (cotton.y + dy + sdy + Math.sin(angle) * dist - SWAB_PIVOT.y) * scale;
        drawOrganicBlob(localX, localY, size * scale, seed + i);
      }
    }

    if (level >= 2) {
      // Niveau 2: Plus de taches, zone élargie (30%)
      const scaleRatio = (SWAB_SCALE / 3.4) * rMul;
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TWO_PI + seed * 0.7;
        const dist = cotton.radius * (0.4 + (i % 2) * 0.5) * scaleRatio * srMul;
        const size = cotton.radius * (0.3 + (i % 3) * 0.2) * scaleRatio * srMul;
        // Coordonnées SVG avec offsets + ajustement manuel, puis soustraire pivot, puis MULTIPLIER par scale
        const localX =
          (cotton.x + dx + sdx + Math.cos(angle) * dist - SWAB_PIVOT.x) * scale;
        const localY =
          (cotton.y + dy + sdy + Math.sin(angle) * dist - SWAB_PIVOT.y) * scale;
        drawOrganicBlob(localX, localY, size * scale, seed + i * 1.2);
      }
      // Centre organique
      const centerX = (cotton.x + dx + sdx - SWAB_PIVOT.x) * scale;
      const centerY = (cotton.y + dy + sdy - SWAB_PIVOT.y) * scale;
      drawOrganicBlob(
        centerX,
        centerY,
        cotton.radius * 0.6 * scaleRatio * scale * srMul,
        seed + 10
      );
    }

    if (level >= 3) {
      // Niveau 3: Presque plein avec taches organiques (45%)
      const scaleRatio = (SWAB_SCALE / 3.4) * rMul;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * TWO_PI + seed * 0.9;
        const dist = cotton.radius * (0.3 + (i % 4) * 0.5) * scaleRatio * srMul;
        const size =
          cotton.radius * (0.4 + (i % 3) * 0.25) * scaleRatio * srMul;
        // Coordonnées SVG avec offsets + ajustement manuel, puis soustraire pivot, puis MULTIPLIER par scale
        const localX =
          (cotton.x + dx + sdx + Math.cos(angle) * dist - SWAB_PIVOT.x) * scale;
        const localY =
          (cotton.y + dy + sdy + Math.sin(angle) * dist - SWAB_PIVOT.y) * scale;
        drawOrganicBlob(localX, localY, size * scale, seed + i * 0.8);
      }
      // Zone centrale large organique
      const centerX = (cotton.x + dx + sdx - SWAB_PIVOT.x) * scale;
      const centerY = (cotton.y + dy + sdy - SWAB_PIVOT.y) * scale;
      drawOrganicBlob(
        centerX,
        centerY,
        cotton.radius * 1.2 * scaleRatio * scale * srMul,
        seed + 20
      );
    }

    if (level >= 4) {
      // Niveau 4: Complètement sale avec forme organique (50%)
      const scaleRatio = (SWAB_SCALE / 3.4) * rMul;
      ctx.globalAlpha = 0.9;
      // Coordonnées SVG avec offsets + ajustement manuel, puis soustraire pivot, puis MULTIPLIER par scale
      const centerX = (cotton.x + dx + sdx - SWAB_PIVOT.x) * scale;
      const centerY = (cotton.y + dy + sdy - SWAB_PIVOT.y) * scale;
      drawOrganicBlob(
        centerX,
        centerY,
        cotton.radius * 2.0 * scaleRatio * scale * srMul,
        seed + 30
      );
    }
  });

  ctx.globalAlpha = 1.0;
  ctx.restore();
}
function getCleanPercentage() {
  if (!earwaxMaskCtx) return 0;
  const imageData = earwaxMaskCtx.getImageData(
    0,
    0,
    earwaxMaskCanvas.width,
    earwaxMaskCanvas.height
  );
  let whitePixels = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 128) whitePixels++;
  }
  return 1 - whitePixels / (imageData.data.length / 4);
}

function drawEarWithWax(fadeOut) {
  if (!svgImages.ear || !svgImages.earwax || !earwaxMaskCanvas) return;

  const earScale = 3.4;
  const earWidth = 161.16 * earScale;
  const earHeight = 239.46 * earScale;
  const earX = centerX - earWidth / 2;
  const earY = centerY - earHeight / 2;

  ctx.save();
  ctx.drawImage(svgImages.ear, earX, earY, earWidth, earHeight);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = earWidth;
  tempCanvas.height = earHeight;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(svgImages.earwax, 0, 0, earWidth, earHeight);
  tempCtx.globalCompositeOperation = "destination-in";
  tempCtx.drawImage(
    earwaxMaskCanvas,
    earX,
    earY,
    earWidth,
    earHeight,
    0,
    0,
    earWidth,
    earHeight
  );

  ctx.globalAlpha = Math.max(0, 1 - fadeOut);
  ctx.drawImage(tempCanvas, earX, earY);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function update(dt) {
  time += dt;
  const mx = input.getX();
  const my = input.getY();
  const onCanvas = mx > 0 || my > 0;

  // Rotation au clic: front montant uniquement
  const justClicked = input.isPressed() && !prevPressed;
  prevPressed = input.isPressed();

  // Si un clic arrive et qu'aucune rotation n'est en cours
  if (justClicked && !isFlipping && onCanvas && !fall) {
    // Rotation de 90° (Math.PI / 2) dans la direction actuelle
    isFlipping = true;
    flipStart = time;
    flipFrom = swabRotation;
    flipTo = swabRotation + (currentDirection * Math.PI) / 2;

    // Jouer le son de rotation
    sounds.turn.currentTime = 0;
    sounds.turn.play().catch(() => {});

    // Incrémenter le compteur de rotations dans cette direction
    rotationsInCurrentDirection++;

    // Si on a fait 2 rotations dans cette direction, on peut changer de sens
    if (rotationsInCurrentDirection >= 2) {
      currentDirection *= -1;
      rotationsInCurrentDirection = 0;
    }
  }
  // Si un clic arrive pendant une rotation et qu'aucune rotation n'est en file d'attente
  else if (justClicked && isFlipping && !queuedRotation && onCanvas && !fall) {
    // Précharger 1 rotation (max)
    queuedRotation = true;
  }

  // Attendre chargement
  if (svgImages.loaded < 3 || !earwaxMaskCanvas) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Fade in
  if (fadeIn < 1) fadeIn = Math.min(fadeIn + dt * 0.5, 1);

  // Check si nettoyé (100% du cérumen OU les deux cotons pleins)
  const cleanPercent = getCleanPercentage();
  if ((cleanPercent >= 0.98 || bothCottonsFull) && cleanTime === -1) {
    cleanTime = time;
  }

  // Animations fin
  if (cleanTime !== -1) {
    const t = time - cleanTime;
    if (t > 0.5) fall = true;
    if (t > 1.7) fadeOut = Math.min((t - 1.7) / 1, 1);
    if (fadeOut >= 1 && !finishCalled) {
      finishCalled = true;
      finish();
    }
  }

  // Mouvement
  if (fall) {
    swabVY += 1200 * dt;
    swabY += swabVY * dt;
    swabRotSpeed += 1.5 * dt;
    swabRotation += swabRotSpeed * dt;
  } else if (onCanvas) {
    // Mouvement fluide avec lerp (comme Alexander-3)
    swabX += (mx - swabX) * 0.2;
    swabY += (my - swabY) * 0.2;
  } else {
    // Quand le curseur sort et revient, on téléporte pour que le lerp reprenne
    swabX = mx;
    swabY = my;
  }

  // Animation rotation FLUIDE
  if (isFlipping) {
    const t = Math.min((time - flipStart) / FLIP_DURATION, 1);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    swabRotation = flipFrom + (flipTo - flipFrom) * ease;
    if (t >= 1) {
      isFlipping = false;
      // Forcer l'angle final à être exactement un multiple de 90°
      swabRotation = flipTo;

      // Si une rotation est en attente, la déclencher immédiatement
      if (queuedRotation) {
        queuedRotation = false;
        isFlipping = true;
        flipStart = time;
        flipFrom = swabRotation;
        flipTo = swabRotation + (currentDirection * Math.PI) / 2;

        // Incrémenter le compteur
        rotationsInCurrentDirection++;

        // Si on a fait 2 rotations dans cette direction, changer de sens
        if (rotationsInCurrentDirection >= 2) {
          currentDirection *= -1;
          rotationsInCurrentDirection = 0;
        }
      }
    }
  }

  // Fond
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (fadeIn > 0) {
    ctx.fillStyle = `rgba(248, 192, 165, ${fadeIn})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Oreille + cérumen
  if (fadeIn > 0) drawEarWithWax(fadeOut);

  // EFFACEMENT au SURVOL (les DEUX cotons nettoient simultanément mais se tachent indépendamment)
  // IMPORTANT : Effacement désactivé pendant l'animation d'apparition (fadeIn < 1)
  if (onCanvas && !fall && fadeIn >= 1 && !bothCottonsFull) {
    const cottons = [COTTON_TOP, COTTON_BOTTOM];

    // Pour chaque coton
    cottons.forEach((cotton, cottonIndex) => {
      const tweak =
        cottonIndex === 0 ? DETECT_TWEAK_SVG.top : DETECT_TWEAK_SVG.bottom;
      const dx = tweak && typeof tweak.dx === "number" ? tweak.dx : 0;
      const dy = tweak && typeof tweak.dy === "number" ? tweak.dy : 0;
      const rMul =
        tweak && typeof tweak.radiusMul === "number" ? tweak.radiusMul : 1;
      // Vérifier si ce coton n'est pas complètement sale (niveau < 4)
      if (cottonDirtyLevel[cottonIndex] < 4) {
        // Générer les points de collision pour ce coton
        const swabPts = [];
        for (let i = 0; i <= 12; i++) {
          const angle = (i / 12) * TWO_PI;
          for (let r = 0; r <= 1; r += 0.5) {
            // Appliquer l'offset (dx,dy) et le multiplicateur de rayon avant rotation
            const px =
              cotton.x + dx + Math.cos(angle) * cotton.radius * r * rMul;
            const py =
              cotton.y + dy + Math.sin(angle) * cotton.radius * r * rMul;
            const rotated = rotatePoint(px, py, swabRotation, SWAB_PIVOT);
            swabPts.push({
              x: swabX + (rotated.x - SWAB_PIVOT.x) * SWAB_SCALE,
              y: swabY + (rotated.y - SWAB_PIVOT.y) * SWAB_SCALE,
            });
          }
        }

        // Vérifier si on est dans la zone de l'oreille (centre de l'écran)
        const centerRot = rotatePoint(
          cotton.x + dx,
          cotton.y + dy,
          swabRotation,
          SWAB_PIVOT
        );
        const cottonCenter = {
          x: swabX + (centerRot.x - SWAB_PIVOT.x) * SWAB_SCALE,
          y: swabY + (centerRot.y - SWAB_PIVOT.y) * SWAB_SCALE,
        };
        const distToCenter = Math.hypot(
          cottonCenter.x - centerX,
          cottonCenter.y - centerY
        );
        const isNearEar = distToCenter < 300; // Dans un rayon de 300px du centre

        // Effacer le cérumen avec ce coton
        earwaxMaskCtx.globalCompositeOperation = "destination-out";
        earwaxMaskCtx.fillStyle = "rgba(0, 0, 0, 0.2)";
        for (let pt of swabPts) {
          earwaxMaskCtx.beginPath();
          earwaxMaskCtx.arc(pt.x, pt.y, cotton.radius * rMul, 0, TWO_PI);
          earwaxMaskCtx.fill();
        }
        earwaxMaskCtx.globalCompositeOperation = "source-over";

        // Marqueurs visuels (rouge) pour ajuster
        if (DEBUG_MARKERS) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,0,0,0.9)";
          ctx.fillStyle = "rgba(255,0,0,0.6)";
          ctx.lineWidth = 2;
          // Cercle principal du coton (avec rMul)
          ctx.beginPath();
          ctx.arc(
            cottonCenter.x,
            cottonCenter.y,
            cotton.radius * SWAB_SCALE * rMul,
            0,
            TWO_PI
          );
          ctx.stroke();
          // Quelques points d'échantillonnage
          for (let i = 0; i < swabPts.length; i += 6) {
            const p = swabPts[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, TWO_PI);
            ctx.fill();
          }
          ctx.restore();
        }

        // Si ce coton est proche de l'oreille, il se tache
        if (isNearEar) {
          // Jouer le son de nettoyage (s'il n'est pas déjà en cours)
          if (sounds.cleaning.paused) {
            sounds.cleaning.currentTime = 0;
            sounds.cleaning.play().catch(() => {});
          }

          // Augmenter le pourcentage nettoyé par CE coton uniquement
          cottonCleanPercent[cottonIndex] += 0.002;

          // Mettre à jour le niveau de saleté de CE coton selon les seuils
          for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
            if (cottonCleanPercent[cottonIndex] >= LEVEL_THRESHOLDS[i]) {
              cottonDirtyLevel[cottonIndex] = i + 1;
            }
          }
        }
      }
    });

    // Vérifier si les deux cotons sont complètement sales (niveau 4)
    if (cottonDirtyLevel[0] >= 4 && cottonDirtyLevel[1] >= 4) {
      bothCottonsFull = true;
      if (cleanTime === -1) {
        cleanTime = time;
      }
    }
  }

  // Coton-tige
  // La rotation se fait autour du curseur (swabX, swabY)
  // VISUAL_SWAB_OFFSET est maintenant appliqué DANS le repère rotatif
  if (onCanvas && swabY > -200 && swabY < canvas.height + 300) {
    drawSwab(swabX, swabY, SWAB_SCALE, swabRotation);
  }

  // Fade noir au début (par-dessus tout pour que le 0 et cérumen apparaissent en dessous)
  if (fadeIn < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - fadeIn})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Fade out final
  if (fadeOut > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeOut})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Marqueur de position du curseur (debug)
  if (DEBUG_MARKERS) {
    ctx.save();
    const r = 10;
    ctx.strokeStyle = "rgba(0, 200, 255, 0.95)"; // cyan pour différencier
    ctx.lineWidth = 2;
    // Cercle
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TWO_PI);
    ctx.stroke();
    // Croix
    ctx.beginPath();
    ctx.moveTo(mx - r - 4, my);
    ctx.lineTo(mx + r + 4, my);
    ctx.moveTo(mx, my - r - 4);
    ctx.lineTo(mx, my + r + 4);
    ctx.stroke();
    ctx.restore();
  }

  // INDICATEUR VISUEL DE SECOUAGE (debug)
  // (supprimé)
}

run(update);
