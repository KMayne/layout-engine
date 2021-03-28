'use strict';

function oppositeAxis(dimension) {
  return dimension === 'width' ? 'height' : 'width';
}

function oppositeOffset(dimension) {
  return dimension === 'x' ? 'y' : 'x';
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
    elem.measure[primaryAxisMeasure] = elem.attributes[primaryAxisMeasure];
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
    elem.measure[secondaryAxisMeasure] = elem.attributes[secondaryAxisMeasure];
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

export function calculateLayout(rootElem, width, height) {
  // Dimension - (_dp | content | fill | _*)
  // * only allowed on primary measure
  // fill only allowed on secondary measure
  // * cannot appear below content in visual tree
  // content cannot appear on a leaf node (could produce a warning?)
  // root element always fills the display area
  rootElem.layout = { x: 0, y: 0, width, height };
  rootElem.children.forEach(measureElem);
  arrangeChildren(rootElem);
}

export function flattenElemTree(elem) {
  return [elem, ...elem.children.flatMap(flattenElemTree)];
}
