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
  attributes.width = tryParseMeasure(attributes.width);
  attributes.height = tryParseMeasure(attributes.height);

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

function tryParseMeasure(measureString) {
  const measureValRegex = /^(?<value>[0-9]+)(?<unit>dp|\*)$/;
  const match = measureString?.match(measureValRegex)?.groups;
  if (match) return { value: Number(match.value), unit: match.unit };
  if (measureString === 'content') return { unit: 'content' };
  if (measureString === 'fill') return { unit: 'fill' };
  if (measureString === undefined) return undefined;
  throw new Error(`Unrecognised measure value: ${measureString}`);
}
