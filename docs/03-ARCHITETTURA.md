# Tradermon · Architettura

## Scelte tecniche

| Ambito | Scelta | Perché |
|---|---|---|
| Motore 2D | **Phaser 4** | È il motore web 2D più maturo, con tilemap, camera, tween e scala a pixel netti. La versione 4 ha un renderer WebGL più veloce e mantiene l'API della 3. |
| Linguaggio e build | **TypeScript** in modalità strict + **Vite** | I tipi proteggono la logica di portafoglio e salvataggi. Vite fa build veloci e un proxy di sviluppo verso il server locale. |
| Interfaccia | Livello **HTML/CSS** sopra il canvas | Il testo è nitido a ogni dimensione, accessibile e selezionabile. Moduli, tabelle e grafici sono facili da fare. Lo stile riproduce le finestre delle portatili anni 2000. |
| Grafica | **Pixel art generata in codice** (`src/art/art.ts`) | È tutta originale e senza licenze di terzi. Molti tileset "in stile" in rete sono estratti da giochi commerciali, quindi non li usiamo. La grafica pesa zero byte di immagini. |
| Caratteri | **@fontsource** (Press Start 2P, Pixelify Sans) | Sono inclusi nel pacchetto, quindi funzionano offline e nella PWA. |
| Test | **Vitest** | Usa la stessa pipeline di Vite e fa girare i test in TypeScript senza configurazione. |
| Server | **Node.js** senza dipendenze | Tiene le chiavi Alpaca fuori dal browser e risolve il CORS. È facile da controllare: un solo file. |

## Mappa del codice

```
src/
  main.ts             avvio: titolo, onboarding o caricamento, poi la scena del mondo
  art/art.ts          tileset con bordi automatici, sprite 16×24, ritratti, fondale del titolo
  scenes/world.ts     scena Phaser: mappa, movimento a griglia, passaggi, NPC, animazioni, HUD
  world/maps.ts       costruzione delle mappe (città, percorsi, interni, Lega, Torre)
  world/scripts.ts    storia ed eventi: Prof, Valigette, rivale, Mentori, Lega, Torre, incontri
  ui/core.ts          dialoghi, menu di scelta, finestre modali, notifiche
  ui/input.ts         tastiera e controlli touch con pila di gestori
  ui/battle.ts        duelli di conoscenza
  ui/timemachine.ts   Macchina del Tempo (mercato simulato con ordini)
  ui/pick.ts          missioni di analisi
  ui/clinic.ts        Clinica del Portafoglio
  ui/live.ts          collegamento Alpaca, Licenza, limiti, ordini reali
  ui/menu.ts          menu di pausa, Investidex, opzioni
  ui/setup.ts         avvertenze, questionario, conto di prova, esame, titolo
  systems/            stato e salvataggi, mercato, portafoglio, quiz, audio, client Alpaca
  data/               asset di fantasia, quiz con fonti, lezioni, eventi, storia, missioni
server/index.mjs      file statici + API /api verso Alpaca (paper e live)
```

## Flusso dei dati

- Lo stato di gioco è un unico oggetto `S` (`systems/state.ts`), salvato in `localStorage` ed esportabile in JSON. Non contiene mai chiavi.
- Il mercato del mondo avanza di un giorno simulato ogni 60 passi sui percorsi e a ogni sfida. È un modello a fattori: beta × mercato + settore + componente propria + shock. Il clima (toro, orso, laterale, tempesta) cambia gli incontri e la tinta del mondo.
- Le missioni generano uno scenario deterministico dal seme, così lo stesso codice sfida dà lo stesso mercato a due amici.
- I tile logici (`TILE`) decidono collisioni ed eventi. La funzione `visualTiles` li traduce in tile grafici: sceglie i bordi automatici di sentieri, acqua e tetti, le varianti e il fotogramma di animazione.

## Sicurezza del denaro reale

1. Il browser parla solo con `127.0.0.1:8888` (porta modificabile con `TRADERMON_PORT`). Il server rifiuta altre origini.
2. Le chiavi vengono verificate presso Alpaca e salvate in `server/.secrets/keys.json`, con permessi 600 e fuori da git.
3. Prima di inviare un ordine il server controlla:
   - il simbolo;
   - per il conto reale, la parola di conferma `CONFERMO` e il tetto `TRADERMON_LIVE_MAX_ORDER`;
   - la liquidità disponibile (niente margine);
   - le posizioni possedute (niente scoperto).
4. Il gioco aggiunge i limiti per Medaglia, il tetto mensile e la pausa di riflessione.
5. Ogni ordine reale è annotato in `server/.secrets/audit.log`.

## Test

`npm test` controlla:
- che ogni domanda sia ben formata e citi una fonte esistente;
- che ogni Mentore abbia abbastanza domande in ogni percorso;
- che passaggi, porte ed edifici delle mappe siano coerenti e che le uscite siano raggiungibili;
- la matematica del portafoglio (costi, niente margine, niente scoperto);
- le metriche e il determinismo degli scenari;
- le protezioni del server.
