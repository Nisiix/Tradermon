# Trailer della landing

Video di 20 secondi in loop, nella sezione `#trailer` della landing (tra "Un gioco per imparare" e "Scegli il percorso").
Il file pubblicato è `public/trailer/tradermon-trailer.mp4` (1280×720, senza audio) con la copertina `tradermon-trailer.jpg`.

Il montaggio è un progetto [HyperFrames](https://hyperframes.heygen.com) (HTML reso in video):

- `index.html`: gli otto spezzoni di gioco e i passaggi tra uno e l'altro (tendina, stacco scuro, cerchio).
- `compositions/map.html`: la Mappa della Regione del gioco. Apre il video a tutto schermo con il titolo, si stringe
  nell'angolo mentre il segnaposto avanza tappa per tappa, torna grande su Wall Street e "vola" a Borgo Semina
  (Trasferimento di Capitale): l'ultimo fotogramma è uguale al primo, così il loop non si vede.
- `compositions/labels.html`: il riquadro con il nome di ogni tappa.

La mappa è la stessa disegnata da `src/ui/regionmap.ts` (posizioni in `REGION_POS` di `src/world/travel.ts`).
Se le città cambiano, aggiorna `STOPS` in `compositions/map.html` e le scritte in `compositions/labels.html`.

## Rifarlo

1. Gioco in locale senza servizio dei salvataggi: `VITE_SUPABASE_URL= VITE_SUPABASE_KEY= npx vite --port 5173`
2. Spezzoni veri del gioco (fotogramma per fotogramma, circa 5 minuti l'uno): `node trailer/cattura.cjs`
   (servono Playwright con Chromium e ffmpeg). Finiscono in `trailer/assets/clips/`, che non va su git.
3. Anteprima e resa: `cd trailer && npx hyperframes preview` poi `npx hyperframes render --quality delivery -o out.mp4`
4. Versione per il sito:
   ```
   ffmpeg -i out.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -an -movflags +faststart ../public/trailer/tradermon-trailer.mp4
   ffmpeg -ss 2.5 -i out.mp4 -frames:v 1 -vf scale=1280:720 -q:v 4 ../public/trailer/tradermon-trailer.jpg
   ```
