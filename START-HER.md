# 🎄 JULEFROKOST ROYALE — ONLINE MULTIPLAYER

Du behøver **ikke installere noget på Windows**. Alle spiller i en browser, og telefonerne kan bruge mobildata eller Wi-Fi.

## Gør spillet offentligt tilgængeligt (kun via browser)

### A. Upload til GitHub

1. Gå til https://github.com/ og opret en gratis konto (hvis du ikke har en).
2. Klik **+** → **New repository**. Navn: `julefrokost-royale`. Vælg gerne **Private** og klik **Create repository**.
3. Download ZIP-pakken, højreklik på ZIP i Stifinder, og vælg **Udpak alle**.
4. Åbn den udpakkede mappe **julefrokost-royale**. Du skal kunne se `server.js`, `package.json`, `render.yaml` og mappen `public`.
5. Gå til dit nye GitHub-repository i browseren. Vælg **uploading an existing file** eller **Add file** → **Upload files**.
6. Træk **indholdet** af den udpakkede `julefrokost-royale`-mappe ind på uploadområdet (alle filer **og** hele `public`-mappen). Klik **Commit changes**. Hvis din browser ikke accepterer en mappe, så opret `public`-mappen ved at uploade dens fire filer via GitHubs filstier eller brug GitHubs browsereditor.
7. Kontrollér, at `server.js` og `package.json` ligger i **øverste niveau**, og at `public/index.html`, `public/host.html`, `public/app.js` og `public/style.css` ligger i undermappen `public`.

### B. Udgiv med Render

1. Åbn https://dashboard.render.com/ og log ind (gratis konto).
2. Klik **New** → **Web Service**.
3. Vælg GitHub som kilde, forbind kontoen, og vælg repository `julefrokost-royale`.
4. Udfyld:
   - **Language / Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (hvis tilgængelig)
5. Klik **Deploy Web Service**. Når status er **Live**, finder du en URL, der ender på `.onrender.com`.

### C. Start festen

1. Åbn `https://DIN-ADRESSE.onrender.com/host` på computeren.
2. Tryk **OPRET NYT SPIL**.
3. Vis værtsvinduet på TV'et, og send **spillerlinket** til vennerne i Messenger/SMS eller vis rumkoden.
4. Spillerne åbner linket på telefonen og skriver navn. Samme Wi-Fi er **ikke** nødvendigt.
5. Når alle er med, trykker du **START SPILLET**. Værten skifter spørgsmål og kan afsløre før tiden.

## Vigtigt at vide

- Gratis Render-servere kan gå i dvale efter 15 minutters inaktivitet; første åbning bagefter kan tage cirka et minut. Åbn spillet og test det inden festen.
- Spil og point gemmes **kun i serverens hukommelse**. Genstarter hostingen, nulstilles spillet. Opbevar derfor ikke et spil, du vil fortsætte senere, i lang tid uden aktivitet. Gratis server kan også blive genstartet uventet.
- Del kun **spillerlinket**; værtsadressen indeholder en hemmelig nøgle og bør ikke sendes ud.
- Du behøver ingen installation på egen PC. Udgivelsen kræver dog en GitHub- og Render-konto.
- Spillet understøtter op til 10 spillere, og værten kan åbnes på computer eller TV-browser.

## Hvis noget driller

- **Render fejler med manglende package.json:** Sørg for, at filen ligger på øverste niveau på GitHub.
- **Siden åbner, men spillere kan ikke joine:** Send det offentlige HTTPS-spillerlink, ikke `localhost`.
- **Rummet forsvinder:** Hostingen er blevet genstartet, og I skal oprette et nyt rum.
- **Spillet ser gammelt ud:** Genindlæs begge browserfaner; ved kodeopdateringer skal Render have afsluttet deploy.

God julefrokost! 🏆
