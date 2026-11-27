# De Lichtvallei

Een WebXR-minigolfspel voor Meta Quest 3 met één speelbare hole en een vlakke oefenbaan.

## Lokaal starten

Installeer Node.js en voer uit:

```sh
npm install
npm run dev
```

Open het getoonde adres op je computer. Voor een productiebuild gebruik je `npm run build`.

## Testen op Quest 3 met HTTPS

Installeer [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) en start de ontwikkelserver met `npm run dev`. Open een tweede terminal en voer uit:

```sh
cloudflared tunnel --protocol http2 --url http://localhost:5173
```

Open het getoonde `https://...trycloudflare.com`-adres in de Quest-browser en kies de VR-knop. Test rondkijken en afsluiten via de VR-knop of het Quest-menu. Laat beide terminals open tijdens het testen. Is poort 5173 bezet, start Vite dan met `npm run dev -- --port 5174` en gebruik dezelfde poort in het tunnelcommando. De tijdelijke link is publiek toegankelijk en verandert wanneer je de tunnel opnieuw start.

## Online publiceren

Voer in de checkout op de server uit:

```sh
git pull --ff-only origin develop
npm ci
npm run build
```

Stel `dist/` in als webroot om de game rechtstreeks op het domein te openen. Als de webroot de projectmap is, stuurt de bronpagina je door naar `/dist/`. De build gebruikt relatieve paden en draait op een statische HTTPS-webserver.

## Spelen op Quest 3

- Stel in de Quest-instellingen een roomscale-grens in en controleer het vloerniveau. Je echte stappen worden één op één gevolgd binnen die ruimte.
- Duw een duimstick om over de virtuele baan te wandelen, ook als je in een kleine ruimte speelt.

- Ga bij de bal staan en houd de controller waar je je hand ontspannen houdt tijdens het putten. Houd grip vast om de putter te bekijken. Laat grip los om de baan op je hand uit te lijnen. De game bewaart die afstelling per speelhand. Om later opnieuw af te stellen, druk op de trigger terwijl je grip vasthoudt.
- Maak een putt zonder knop. Houd de gripknop vast als je een oefenslag wilt maken.
- Druk op de trigger van je andere hand om van speelhand te wisselen.
- Druk op de trigger van je speelhand wanneer de ring rond de bal verschijnt om naast de bal te gaan staan.
- Druk na het uitholen op de trigger van je speelhand om opnieuw te beginnen. Met de gripknop van je andere hand schakel je het geluid.
- Houd X op je linkercontroller vast om terug te gaan naar het startscherm.
- Sla om de wortel heen, of gebruik de paarse paddenstoel om met de bal over de wortel te springen.

De melodie en geluidseffecten worden door het project zelf via Web Audio opgebouwd. Er zitten geen opnames, samples of muziekbestanden van derden in de demo.

## Kamerbaan met passthrough

Kies **Kamerbaan met passthrough** in de Quest-browser en start de kamerbaan. Kies tussen **Rechte putt**, **Smalle poort** en **Slalom** met de duimstick naar links of rechts, of met A en B op je rechtercontroller. Kijk naar een lege plek op de vloer. In het kader van 1,35 bij 2,35 meter zie je de obstakels en de cup van de gekozen baan. Druk op de trigger van je speelhand om de baan te plaatsen. Je eigen vloer blijft zichtbaar tussen de randen.

Loop fysiek binnen de ingestelde speelruimte naar de virtuele bal. Houd grip vast bij de bal en laat los om de putter af te stellen. Houd tijdens je slag de **linkertrigger** ingedrukt. De putterkop wordt goud zodra je kunt slaan. Druk na het uitholen op de **rechtertrigger** om opnieuw te spelen op dezelfde plek. Houd **X** vast om terug te gaan naar het startscherm, waar je opnieuw een baan kunt kiezen.
