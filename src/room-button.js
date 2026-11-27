export function createRoomButton(renderer, status) {
  const button = document.createElement('button');
  button.id = 'room-start';
  button.type = 'button';
  button.disabled = true;
  button.textContent = 'Kamerbaan starten';
  const xr = navigator.xr;

  xr?.isSessionSupported('immersive-ar').then((supported) => {
    button.disabled = !supported;
    if (!supported) status.textContent = 'Open de kamerbaan in de browser van je Quest met passthrough.';
  }).catch(() => {
    status.textContent = 'Passthrough is hier niet beschikbaar.';
  });
  if (!xr) status.textContent = 'Open de kamerbaan in de browser van je Quest via HTTPS.';

  button.addEventListener('click', async () => {
    const current = renderer.xr.getSession();
    if (current) {
      await current.end();
      return;
    }

    button.disabled = true;
    let session;
    try {
      session = await xr.requestSession('immersive-ar', { requiredFeatures: ['local-floor'] });
      if (session.environmentBlendMode === 'opaque') {
        await session.end();
        status.textContent = 'Deze sessie geeft geen passthrough door.';
        return;
      }
      await renderer.xr.setSession(session);
      button.textContent = 'Kamerbaan sluiten';
      session.addEventListener('end', () => {
        button.textContent = 'Kamerbaan starten';
        status.textContent = 'Start de kamerbaan opnieuw om de plek te wijzigen.';
      }, { once: true });
    } catch {
      if (session) await session.end().catch(() => {});
      status.textContent = 'Passthrough kon niet starten. Controleer je Quest-speelruimte en probeer opnieuw.';
    } finally {
      button.disabled = false;
    }
  });
  return button;
}
