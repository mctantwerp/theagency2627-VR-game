const paper = '#f5f0e4';
const ink = '#202d26';
const subdued = '#4d5a51';

export function drawRoomPanel(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#355746';
  context.fillRect(0, 0, 8, height);
  context.textAlign = 'left';
  context.textBaseline = 'middle';
}

export function drawRoomHeading(context, title, detail, meta = '') {
  context.fillStyle = subdued;
  context.font = '600 23px system-ui';
  context.textAlign = 'left';
  context.fillText(detail, 37, 32);
  context.textAlign = 'right';
  context.fillText(meta, 733, 32);
  context.textAlign = 'left';
  context.fillStyle = ink;
  context.font = '600 50px Georgia, serif';
  context.fillText(title, 35, 83, 698);
  context.fillStyle = '#c8cabc';
  context.fillRect(36, 119, 696, 2);
}

export function drawRoomAction(context, action, key, y, primary = false) {
  if (primary) {
    context.fillStyle = '#355746';
    context.fillRect(36, y - 20, 696, 40);
  }
  context.fillStyle = primary ? paper : ink;
  context.textAlign = 'left';
  context.font = '600 27px system-ui';
  context.fillText(action, 49, y, key ? 425 : 670);
  context.textAlign = 'right';
  context.font = '600 22px system-ui';
  context.fillText(key, 719, y, 230);
  context.textAlign = 'left';
}

export function drawRoomNote(context, text, x, y, width) {
  context.textAlign = 'left';
  context.fillStyle = subdued;
  context.font = '500 22px system-ui';
  context.fillText(text, x, y, width);
}
