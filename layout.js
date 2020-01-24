'use strict';

const colours = [
  '#F2DC5D',
  '#F2A359',
  '#DB9065',
  '#A4031F',
  '#240B36',
  '#71A2B6',
  '#C4F1BE'
];

function invertColour(hex) {
  const number = Number.parseInt(hex.substring(1), 16);
  const inverted = number ^ 0xFFFFFF;
  return `#${inverted.toString(16).padStart(6, '0')}`;
}

const domParser = new DOMParser();
function parseLayout(xmlDocString) {
  const xmlDoc = domParser.parseFromString(xmlDocString, 'application/xml');
  return parseNode(xmlDoc.documentElement);
}

function parseNode(node) {
  const attributes = Object.fromEntries(Object.entries(node.attributes)
    .map(attribArray => ([attribArray[1].name, attribArray[1].nodeValue])
  ));
  return {
    nodeName: node.nodeName,
    attributes,
    children: Array.from(node.childNodes)
      .filter(node => !(node.nodeType === 3 && node.nodeValue.trim() === ''))
      .map(parseNode)
  }
}

const layoutPromise = fetch('layouts/single-element.imu')
  .then(response => response.text())
  .then(parseLayout);

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('canvas');
  window.addEventListener('resize', () => runLayout(canvas));
  console.log(await layoutPromise);
  runLayout(canvas, await layoutPromise);
});

function oppositeAxis(dimension) {
  return dimension === 'width' ? 'height' : 'width';
}

function oppositeOffset(dimension) {
  return dimension === 'x' ? 'y' : 'x';
}

function resolveContentDimensions(elem) {
  const layoutAttribute = elem.attributes['layout-direction'] === 'column' ? 'height' : 'width';
  if (elem.attributes.width === 'content') {
    if (layout) {}
    // elem.layout.width = elem
  }
  if (elem.attributes.height === 'content') {

  }
}

// 2 passes -> 1 upwards (fills in all content & dp), then downwards (fills in * & x + y offsets)
function calculateLayout(elem, layoutOffset) {
  const measureAttribute = elem.attributes['layout-direction'] === 'column' ? 'height' : 'width';
  const offsetAttribute = elem.attributes['layout-direction'] === 'column' ? 'y' : 'x';
  elem.layout = { ...elem.layout };

  elem.children.reduce((layoutOffset, childElem) => {
    calculateLayout(childElem, layoutOffset);
    return layoutOffset + childElem.layout[measureAttribute];
  }, 0);

  const measureValRegex = /^(content)|([0-9]+)(dp|\*)$/;
  const measureValue = elem.attributes[measureAttribute];
  elem.layout[measureAttribute] = 200;
  elem.layout[offsetAttribute] = layoutOffset;
  elem.layout[oppositeOffset(offsetAttribute)] = 0;
  // switch (elem.attributes[measureAttribute]) {
  //   case '_*': // parent must calculate -> requires top-down resolution
  //               // and knowledge of siblings (maybe better to traverse in XML format?)
  //     break;
  //   case 'content': // -> requires bottom up resolution
  //     elem.layout[measureAttribute] = elem.children.reduce((sum, child) => sum + elem.layout[measureAttribute], 0);
  //     break;
  //   case '_dp':
  //     break;
  // }
  elem.layout[oppositeAxis(measureAttribute)] = 100;
}

function emitRectangles(elem) {
  return [
    new Rect(elem.layout.x, elem.layout.y, elem.layout.width, elem.layout.height),
    ...elem.children.flatMap(emitRectangles)
  ];
}

function runLayout(canvasElem, rootElem) {
  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientHeight;

  if (rootElem.nodeName !== 'imuroot') throw new Error('Unexpected root element');
  // Dimension - (_dp | _* | content)
  // * cannot appear below content in visual tree
  // content cannot appear on a leaf node (could produce a warning?)
  // root element is always width="*", height="*"
  // Probably want to avoid implicit values
  calculateLayout(rootElem, 0);
  rootElem.layout.width = canvas.width;
  rootElem.layout.height = canvas.height;

  const rectangles = emitRectangles(rootElem);
  console.log(rectangles);

  const ctx = canvas.getContext('2d');
  rectangles.forEach((rect, index) => {
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
    ctx.fillStyle = inverseColour;
    ctx.fillText(String(index), rect.x + rect.width * 0.35, rect.y + rect.height * 0.8);
  });
}

class Rect {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}
