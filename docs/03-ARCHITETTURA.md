# Tradermon · Architettura

## Scelte tecniche

| Ambito | Scelta | Perché |
|---|---|---|
| Motore 2D | **Phaser 4** | È il motore web 2D più maturo, con tilemap, camera, tween e scala a pixel netti. La versione 4 ha un renderer WebGL più veloce e mantiene l'API della 3. |
| Linguaggio e build | **TypeScript** in modalità strict + **Vite** | I tipi proteggono la logica di portafoglio e salvataggi. Vite fa build veloci e un proxy di sviluppo verso il server locale. |
| Interfaccia | Livello **HTML/CSS** sopra il canvas | Il testo è nitido a ogni dimensione, accessibile e selezionabile. Moduli, tabelle e grafici sono facili da fare. Lo stile riproduce le finestre delle portatili anni 2000. |
| Grafica | **Pixel art generata in codice** (`src/art/art.ts`) | È tutta originale e senza licenze di terzi. Molti tileset "in stile" in rete sono estratti da giochi commerciali, quindi non li usiamo. La grafica pesa zero byte di immagini. |
| Resa | **Risoluzione interna ×3 con Scale3x** e filtri della camera | La griglia logica resta 240×160, ma ogni tile e sprite viene ingrandito tre volte con un filtro Scale3x (scritto in casa: la libreria `hqx` è LGPL e dipende da canvas nativo) e il canvas è poi adattato allo schermo con interpolazione lineare. Così niente sfocatura né pixel "a scalini" a dimensioni non intere. Phaser 4 aggiunge vignettatura e una leggera saturazione (`camera.filters`). |
| Prototipo 2.5D | **Three.js** (MIT) in `src/proto/hd2d.ts`, pagina `hd2d.html` | Phaser 4 non carica modelli 3D (ha solo `mesh2d`, luci e shader 2D). Per una resa "HD-2D" come Pokémon su DS (mappa inclinata, case con volume, personaggi-cartello, ombre, luci di notte) il prototipo ricostruisce la mappa con geometrie 3D semplici e riusa come texture la stessa pixel art generata dal gioco: terreno piatto per cella, muri e tetti come parallelepipedi, alberi e personaggi come billboard. Nessun modello di terzi: tutto resta originale. È un banco di prova separato dal gioco; l'integrazione richiederebbe di riscrivere solo la resa di `scenes/world.ts`, lasciando mappe, script, dati e interfaccia com'è. |
| Musica | **Chiptune generata in codice** (`src/systems/music.ts`) | Web Audio, oscillatori quadra/triangolo e rumore: nessun file audio, nessuna licenza. Otto brani (titolo, città, percorso, interni, Accademia, duello, Lega, notte) con tempo e modo che cambiano con il clima di mercato. |
| Caratteri | **@fontsource** (DotGothic16 per i testi, Press Start 2P solo per il titolo) | DotGothic16 è un carattere a pixel molto leggibile anche piccolo. I font sono inclusi nel pacchetto, quindi funzionano offline e nella PWA. Le legature sono disattivate. |
| Test | **Vitest** | Usa la stessa pipeline di Vite e fa girare i test in TypeScript senza configurazione. |
| Server | **Node.js** senza dipendenze | Tiene le chiavi Alpaca fuori dal browser e risolve il CORS. È facile da controllare: un solo file. |

## Mappa del codice

```
src/
  main.ts             avvio: titolo, onboarding o caricamento, poi la scena del mondo
  art/art.ts          tileset in stile DS con bordi automatici e ombre portate, sprite 16×24 con contorni colorati, ritratti Scale2x, fondale del titolo
  scenes/world.ts     scena Phaser: mappa, movimento a griglia (passo alternato, giro sul posto, urto), passaggi con dissolvenza, NPC che passeggiano, erba alta, fumetto "!", HUD
  world/maps.ts       costruzione delle mappe (città, percorsi, interni, Lega, Torre)
  world/scripts.ts    storia ed eventi: Prof, Valigette, rivale, Mentori, Lega, Torre
  ui/core.ts          dialoghi, menu di scelta, finestre modali, notifiche
  ui/input.ts         tastiera e controlli touch con pila di gestori
  ui/battle.ts        duelli di conoscenza
  ui/timemachine.ts   Macchina del Tempo (mercato simulato con ordini)
  ui/pick.ts          missioni di analisi
  ui/clinic.ts        Clinica del Portafoglio
  ui/live.ts          collegamento Alpaca, Licenza, limiti, ordini reali
  ui/menu.ts          menu di pausa, Investidex, opzioni
  ui/setup.ts         avvertenze, questionario, conto di prova, esame, titolo
  ui/tutorial.ts      mini tutorial dei comandi (tastiera o touch)
  ui/agenda.ts        Agenda del giorno e della settimana, storie in corso, rivincite, traguardi e oggetti
  ui/journal.ts       Diario dell'investitore: motivo dopo ogni operazione, rilettura dopo 30 giorni
  ui/minigames.ts     i quattro minigiochi didattici con punteggio 0-100
  ui/challenge.ts     sfida della settimana: quiz con seme ISO, classifica locale, codici con controllo
  world/quests.ts     storie a tappe degli abitanti (sei), con bersagli, lezioni ed eventi
  world/decor.ts      arredo della casa di Borgo Semina in base agli oggetti sbloccati
  systems/progress.ts eventi di gioco (track), agenda, rivincite, traguardi, titoli
  systems/music.ts    motore chiptune e scelta del brano per mappa
  systems/            stato e salvataggi, mercato, portafoglio, quiz, audio, client Alpaca
  data/               asset di fantasia, quiz con fonti, lezioni, eventi, storia, missioni
server/index.mjs      file statici + API /api verso Alpaca (paper e live)
```

## Flusso dei dati

- Lo stato di gioco è un unico oggetto `S` (`systems/state.ts`), salvato in `localStorage` ed esportabile in JSON. Non contiene mai chiavi.
- Tutti i dati del browser hanno il prefisso `tradermon.` e restano solo in `localStorage` (mai sessionStorage, mai un server). Su Safari un avviso una tantum (`ui/storageNotice.ts`) ricorda che i dati di siti non aperti per ~7 giorni possono essere cancellati.
- **Cambio di indirizzo (trasloco, `systems/transfer.ts`)**: il `localStorage` è legato al dominio. Se il gioco si sposta, il vecchio indirizzo va pubblicato ancora con `VITE_MOVED_TO=<nuovo URL>`: all'apertura comprime i dati `tradermon.*` e reindirizza a `<nuovo URL>#trasloco=…`. L'hash non viene mai inviato al server; il nuovo indirizzo lo importa (vince la partita con più tempo di gioco, l'altra resta in `tradermon.save.backup`, con conferma se ce n'è già una) e pulisce la barra degli indirizzi.
- Il mercato del mondo avanza di un giorno simulato ogni 60 passi sui percorsi e a ogni sfida. È un modello a fattori: beta × mercato + settore + componente propria + shock. Il clima (toro, orso, laterale, tempesta) cambia la tinta del mondo. Il gioco non modifica mai il patrimonio fuori dalle operazioni del giocatore e dal mercato.
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
