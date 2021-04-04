'use strict';

function oppositeAxis(dimension) {
  return dimension === 'width' ? 'height' : 'width';
}

function oppositeOffset(dimension) {
  return dimension === 'x' ? 'y' : 'x';
}

function measureAxis(elem, dimensionName, isPrimaryAxis) {
  if (elem.attributes[dimensionName]?.unit === 'content') {
    const dimensionForChildren = elem.children.map(child => {
      if (child.measure[dimensionName].unit !== 'dp') {
        throw new Error('Non-definite unit (i.e. not dp nor content) may not appear along an axis with a ' +
          `content-sized box - child is ${JSON.stringify(child)}`);
      }
      return child.measure[dimensionName].value;
    });
    if (dimensionForChildren.length === 0) {
      throw new Error(`'content' cannot be used for elements with no children, elem: ${elem}`);
    }
    return isPrimaryAxis
      ? { 'value': dimensionForChildren.reduce((acc, dimension) => acc + dimension, 0), 'unit': 'dp' }
      : { 'value': Math.max(...dimensionForChildren), 'unit': 'dp' };
  }

  return elem.attributes[dimensionName];
}

// This stage replaces 'content' values with the measured size of the content and inserts the default values.
// Content values must be definite (i.e. all child elements eventually resolve to dp-type values with no star elements)
function measureElem(elem) {
  elem.children.forEach(measureElem);
  elem.measure = {
    width: measureAxis(elem, 'width', elem.attributes['layout-direction'] !== 'column'),
    height: measureAxis(elem, 'height', elem.attributes['layout-direction'] === 'column')
  };
}

// Parent needs to do layout (including sizing of * units)
// 2 passes -> 1 upwards (fills in all content & dp), then downwards (fills in * & x + y offsets)
// Element passed in must have been "measured.
function arrangeChildren(elem) {
  const primaryAxisOffset = elem.attributes['layout-direction'] === 'column' ? 'y' : 'x';
  const secondaryAxisOffset = oppositeOffset(primaryAxisOffset);
  const primaryAxisMeasure = elem.attributes['layout-direction'] === 'column' ? 'height' : 'width';
  const secondaryAxisMeasure = oppositeAxis(primaryAxisMeasure);

  const contentPrimaryMeasure = elem.children.reduce((acc, child) => {
    const childPrimaryMeasure = child.measure[primaryAxisMeasure] || { value: 1, unit: '*' };
    return {
      ...acc,
      [childPrimaryMeasure.unit]: acc[childPrimaryMeasure.unit] + childPrimaryMeasure.value
    };
  }, { 'dp': 0, '*': 0 });
  const starUnitValue = (elem.layout[primaryAxisMeasure] - contentPrimaryMeasure.dp) / contentPrimaryMeasure['*'];

  elem.children.reduce((layoutOffset, child) => {
    const childPrimaryMeasure = child.measure[primaryAxisMeasure] || { value: 1, unit: '*' };
    const childSecondaryMeasure = child.measure[secondaryAxisMeasure] || { unit: 'fill' };

    const childPrimarySize =
      childPrimaryMeasure.unit === 'dp'
      ? childPrimaryMeasure.value
      : childPrimaryMeasure.value * starUnitValue;

    let childSecondarySize;
    if (childSecondaryMeasure.unit === 'fill') {
      childSecondarySize = elem.layout[secondaryAxisMeasure];
    } else if (childSecondaryMeasure.unit === 'dp') {
      childSecondarySize = childSecondaryMeasure.value;
    } else if (childSecondaryMeasure.unit === '*') {
      throw new Error(`Star value not allowed on secondary axis - bad element: ${JSON.stringify(child)}`)
    } else {
      throw new Error(`Unexpected unmeasured child - this should not happen. Measure was: ${JSON.stringify(childSecondaryMeasure)}`);
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
  // Dimension
  // Primary measure ( content | dp | * )
  // Secondary measure ( content | dp | fill | [TODO: %] )
  // * cannot appear below 'content' in visual tree
  // content cannot appear on a leaf node (could produce a warning?)
  // root element always fills the display area
  rootElem.layout = { x: 0, y: 0, width, height };
  rootElem.children.forEach(measureElem);
  arrangeChildren(rootElem);
}

export function flattenElemTree(elem) {
  return [elem, ...elem.children.flatMap(flattenElemTree)];
}
