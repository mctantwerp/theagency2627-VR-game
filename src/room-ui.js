const surface = '#152523';
const ink = '#fbf7e9';
const subdued = '#cbd8ce';
const highlight = '#f4c768';
const font = 'Manrope, system-ui, sans-serif';

export function loadRoomTypeface(invalidate) {
  globalThis.document?.fonts?.load('600 28px Manrope').then(invalidate).catch(() => {});
}

export function drawRoomPanel(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = surface;
  context.beginPath();
  context.roundRect(1, 1, width - 2, height - 2, 17);
  context.fill();
  context.textAlign = 'left';
  context.textBaseline = 'middle';
}

export function drawRoomHeading(context, title, detail, meta = '') {
  context.fillStyle = highlight;
  context.font = `700 24px ${font}`;
  context.textAlign = 'left';
  context.fillText(detail, 32, 29);
  context.textAlign = 'right';
  context.fillStyle = subdued;
  context.fillText(meta, 736, 29);
  context.textAlign = 'left';
  context.fillStyle = ink;
  context.font = `800 52px ${font}`;
  context.fillText(title, 30, 78, 706);
  context.fillStyle = '#41544e';
  context.fillRect(32, 111, 704, 2);
}

export function drawRoomAction(context, action, key, y, primary = false) {
  if (primary) {
    context.fillStyle = highlight;
    context.fillRect(32, y - 21, 704, 42);
  }
  context.fillStyle = primary ? surface : ink;
  context.textAlign = 'left';
  context.font = `750 30px ${font}`;
  context.fillText(action, 46, y, key ? 380 : 675);
  context.textAlign = 'right';
  context.font = `700 25px ${font}`;
  context.fillText(key, 722, y, 274);
  context.textAlign = 'left';
}

export function drawRoomNote(context, text, x, y, width) {
  context.textAlign = 'left';
  context.fillStyle = subdued;
  context.font = `650 26px ${font}`;
  context.fillText(text, x, y, width);
}
