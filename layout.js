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
      .filter(node =>
        // Whitespace-only text node
        !(node.nodeType === 3 && node.nodeValue.trim() === '')
        // Comment node
        && node.nodeType !== 8
      )
      .map(parseNode)
  }
}

const layoutFile = location.search.substring(1) || 'complex-layout';
const layoutPromise = fetch(`layouts/${layoutFile}.imu`)
  .then(response => response.text())
  .then(parseLayout);

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('canvas');
  window.addEventListener('resize', async () => runLayout(canvas, await layoutPromise));
  runLayout(canvas, await layoutPromise);
});

function oppositeAxis(dimension) {
  return dimension === 'width' ? 'height' : 'width';
}

function oppositeOffset(dimension) {
  return dimension === 'x' ? 'y' : 'x';
}

function parseMeasure(measureString) {
  const measureValRegex = /^(?<value>[0-9]+)(?<unit>dp|\*)$/;
  const match = measureString.match(measureValRegex).groups;
  return {
    value: Number(match.value),
    unit: match.unit
  }
}

function measureElem(elem) {
  const primaryAxisMeasure = elem.attributes['layout-direction'] === 'column' ? 'height' : 'width';
  const secondaryAxisMeasure = oppositeAxis(primaryAxisMeasure);

  elem.children.forEach(measureElem);

  const contentSize = {
    [primaryAxisMeasure]: elem.children.reduce((sum, child) =>
      sum + (child.measure[primaryAxisMeasure].unit === 'dp' ? child.measure[primaryAxisMeasure].value : 0), 0),
    [secondaryAxisMeasure]: Math.max(...elem.children.map(child => child.measure[secondaryAxisMeasure].value), 0)
  };

  elem.measure = {};

  if (elem.attributes[primaryAxisMeasure] === 'content') {
    if (elem.children.length === 0) console.warn('Content-sized box had 0 children');
    elem.measure[primaryAxisMeasure] = {
       value: contentSize[primaryAxisMeasure],
       unit: 'dp'
    };
  } else {
    elem.measure[primaryAxisMeasure] = parseMeasure(elem.attributes[primaryAxisMeasure]);
    if (elem.measure[primaryAxisMeasure].value < contentSize[primaryAxisMeasure].value) {
      throw new Error('Box overflow');
    }
  }

  if (elem.attributes[secondaryAxisMeasure] === 'content') {
    elem.measure[secondaryAxisMeasure] = {
      value: contentSize[secondaryAxisMeasure],
      unit: 'dp'
    };
  } else {
    elem.measure[secondaryAxisMeasure] = parseMeasure(elem.attributes[secondaryAxisMeasure]);
  }
}

// Parent needs to do layout (including sizing of * units)
// 2 passes -> 1 upwards (fills in all content & dp), then downwards (fills in * & x + y offsets)
function arrangeChildren(elem) {
  const primaryAxisOffset = elem.attributes['layout-direction'] === 'column' ? 'y' : 'x';
  const secondaryAxisOffset = oppositeOffset(primaryAxisOffset);
  const primaryAxisMeasure = elem.attributes['layout-direction'] === 'column' ? 'height' : 'width';
  const secondaryAxisMeasure = oppositeAxis(primaryAxisMeasure);

  const contentMeasure = elem.children.reduce((acc, child) => {
    const childPrimaryMeasure = child.measure[primaryAxisMeasure];
    return {
      ...acc,
      [childPrimaryMeasure.unit]: acc[childPrimaryMeasure.unit] + childPrimaryMeasure.value
    };
  }, { 'dp': 0, '*': 0 });
  const starUnitValue = (elem.layout[primaryAxisMeasure] - contentMeasure.dp) / contentMeasure['*'];

  elem.children.reduce((layoutOffset, child) => {
    const childPrimaryMeasure = child.measure[primaryAxisMeasure];
    const childSecondaryMeasure = child.measure[secondaryAxisMeasure];

    const childPrimarySize =
      childPrimaryMeasure.unit === 'dp'
      ? childPrimaryMeasure.value
      : childPrimaryMeasure.value * starUnitValue;
    const childSecondarySize =
      childSecondaryMeasure.unit === 'dp'
      ? childSecondaryMeasure.value
      : elem.layout[secondaryAxisMeasure];

    if (childSecondaryMeasure.unit === '*' && childSecondaryMeasure.value > 1) {
      console.warn('Ignoring star value on secondary axis');
    }

    child.layout = {
      [primaryAxisOffset]: elem.layout[primaryAxisOffset] + layoutOffset,
      [secondaryAxisOffset]: elem.layout[secondaryAxisOffset],
      [primaryAxisMeasure]: childPrimarySize,
      [secondaryAxisMeasure]: childSecondarySize
    };
    return layoutOffset + childPrimarySize;
  }, 0);

  elem.children.forEach(arrangeChildren);
}

function flattenElemTree(elem) {
  return [elem, ...elem.children.flatMap(flattenElemTree)];
}

function runLayout(canvasElem, rootElem) {
  console.log(rootElem);

  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientHeight;

  if (rootElem.nodeName !== 'imuroot') throw new Error('Unexpected root element');
  // Dimension - (_dp | content | fill)
  // * only allowed on primary measure
  // fill only allowed on secondary measure
  // * cannot appear below content in visual tree
  // content cannot appear on a leaf node (could produce a warning?)
  // root element always fills the display area
  rootElem.layout = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  };
  rootElem.children.forEach(measureElem);
  arrangeChildren(rootElem);

  const elements = flattenElemTree(rootElem);
  elements.forEach((elem, index) => elem.number = index);
  const rectangles = elements.map(elem =>
    new Rect(elem.layout.x, elem.layout.y, elem.layout.width, elem.layout.height));


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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = inverseColour;
    ctx.fillText(String(index), rect.x + rect.width * 0.5, rect.y + rect.height * 0.5, rect.width);
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
