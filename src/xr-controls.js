export function controllerGamepad(inputSources, hand) {
  for (const { handedness, gamepad } of inputSources ?? []) {
    if (handedness === hand && gamepad?.mapping === 'xr-standard') return gamepad;
  }
  return null;
}

export function setupHomeShortcut(goHome) {
  let held = 0;
  let exiting = false;

  return function updateHomeShortcut(session, delta) {
    const pressed = session?.visibilityState === 'visible' &&
      controllerGamepad(session.inputSources, 'left')?.buttons[4]?.pressed;
    if (!pressed || delta <= 0 || delta > 0.1) {
      held = 0;
      return;
    }
    if (exiting) return;

    held += delta;
    if (held < 0.7) return;
    exiting = true;
    return session.end().then(goHome, () => {
      held = 0;
      exiting = false;
    });
  };
}
