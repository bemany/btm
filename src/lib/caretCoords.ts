// Liefert die Pixel-Koordinaten der Caret-Position innerhalb eines
// <textarea> oder <input> relativ zum Element. Standardtrick: ein
// Mirror-<div> mit identischer Typografie, gleicher Inhalt bis zur
// Caret-Position, am Ende ein <span> — dessen offsetTop/offsetLeft
// liest man dann ab.
//
// Ursprung: github.com/component/textarea-caret-position (~60 LOC, MIT).
// Hier minimalistische Variante.

const PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

export interface CaretCoords {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number,
): CaretCoords {
  const isInput = el.nodeName === 'INPUT';
  const div = document.createElement('div');
  div.id = '__caret-mirror';
  document.body.appendChild(div);
  const style = div.style;
  const computed = window.getComputedStyle(el);

  style.whiteSpace = 'pre-wrap';
  if (!isInput) style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';

  for (const prop of PROPS) {
    style[prop as 'fontSize'] = computed[prop as 'fontSize'];
  }

  div.textContent = el.value.substring(0, position);
  if (isInput) div.textContent = (div.textContent ?? '').replace(/\s/g, ' ');

  const span = document.createElement('span');
  span.textContent = el.value.substring(position) || '.';
  div.appendChild(span);

  const coords: CaretCoords = {
    top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
    height: parseInt(computed.lineHeight, 10) || parseInt(computed.fontSize, 10),
  };

  document.body.removeChild(div);
  return coords;
}
