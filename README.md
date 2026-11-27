# De Lichtvallei

Een WebXR-minigolfspel voor Meta Quest 3. De eerste scène test het starten en afsluiten van VR.

## Lokaal starten

Installeer Node.js en voer uit:

```sh
npm install
npm run dev
```

Open het getoonde adres op je computer. Voor een productiebuild gebruik je `npm run build`.

## Testen op Quest 3

WebXR vereist een beveiligde context. Publiceer de build op een HTTPS-adres en open dat adres in de Quest-browser. Kies de VR-knop om de scène te betreden. Kijk rond en sluit de sessie via de VR-knop of het Quest-menu.

Voor lokaal testen via USB kun je Android Platform Tools installeren en ontwikkelaarsmodus en USB-debugging op de Quest inschakelen. Verbind de headset, accepteer de debuggingvraag en voer op de computer uit:

```sh
adb devices
adb reverse tcp:5173 tcp:5173
npm run dev
```

Open `http://localhost:5173` in de Quest-browser. Localhost geldt als beveiligde context. Controleer het poortnummer in de Vite-uitvoer en pas beide poorten aan als 5173 bezet is. Test het starten, rondkijken en afsluiten op de headset zelf.
