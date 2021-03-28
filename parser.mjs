export function parseLayout(xmlDocString) {
  const domParser = new DOMParser();
  const xmlDoc = domParser.parseFromString(xmlDocString, 'application/xml');
  if (xmlDoc.documentElement.nodeName !== 'imuroot') {
    throw new Error('Unexpected root element');
  }

  return parseNode(xmlDoc.documentElement);
}

function parseNode(node) {
  const attributes = Object.fromEntries(Object.entries(node.attributes)
    .map(attribArray => ([attribArray[1].name, attribArray[1].nodeValue])
  ));
  if (attributes.width && attributes.width !== 'content') attributes.width = parseMeasure(attributes.width);
  if (attributes.height && attributes.height !== 'content') attributes.height = parseMeasure(attributes.height);

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

function parseMeasure(measureString) {
  const measureValRegex = /^(?<value>[0-9]+)(?<unit>dp|\*)$/;
  const match = measureString.match(measureValRegex).groups;
  return {
    value: Number(match.value),
    unit: match.unit
  }
}
