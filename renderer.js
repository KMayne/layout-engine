'use strict';
import { flattenElemTree } from './layout.js';

function invertColour(hex) {
  const number = Number.parseInt(hex.substring(1), 16);
  const inverted = number ^ 0xFFFFFF;
  return `#${inverted.toString(16).padStart(6, '0')}`;
}

const colours = [
  '#F2DC5D',
  '#F2A359',
  '#DB9065',
  '#A4031F',
  '#240B36',
  '#71A2B6',
  '#C4F1BE'
];

export function drawLayout(rootElem, canvasElem) {
  const elements = flattenElemTree(rootElem);
  elements.forEach((elem, index) => elem.number = index);

  const ctx = canvas.getContext('2d');
  elements.forEach((elem, index) => {
    const rect = elem.layout;
    const colour = colours[index % colours.length];
    const inverseColour = invertColour(colour);
    // Draw box
    ctx.fillStyle = colour;
    ctx.strokeStyle = inverseColour;
    ctx.setLineDash([5]);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    // Label box
    ctx.font = `${rect.height * 0.8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = inverseColour;
    ctx.fillText(
      String(elem.number),
      rect.x + rect.width  * 0.5,
      rect.y + rect.height * 0.5,
      rect.width
    );
  });
}
