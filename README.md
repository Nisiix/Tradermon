# Tradermon · Il viaggio dell'investitore

Tradermon è un gioco di ruolo educativo sugli investimenti, nello stile dei giochi per console portatili dei primi anni 2000. Il mondo, i personaggi e la grafica sono originali. Ci si muove su una mappa, si sfidano gli altri investitori con quiz di finanza e si superano missioni di trading su periodi veri di mercato. Si sconfiggono 8 Mentori, poi si affronta la Lega degli Investitori. Titoli, prezzi e grafici sono reali: arrivano da Alpaca, con le chiavi del giocatore. Nel gioco non esistono titoli o andamenti inventati.

> **Non è consulenza finanziaria.** Tutto il gioco si completa con denaro finto, su un conto Alpaca **Paper** (gratuito, basta un'email). Senza conto collegato resta aperto tutto il percorso di studio (storia, duelli, biblioteche, Attestati), ma non la parte pratica (Sigilli, Lega, grafici e titoli reali). Il collegamento a un conto reale (Live) è facoltativo, fuori dalla storia, si sblocca solo dopo il primo Attestato e un esame, ed è limitato da tetti prudenti.

## Avvio rapido

Serve Node.js 20 o più recente.

```bash
npm install
npm run dev        # gioco su http://localhost:5173 + server locale Alpaca su 127.0.0.1:8888
```

Versione di produzione (un solo processo, nessuna dipendenza a runtime):

```bash
npm run build
npm start          # apri http://localhost:8888
```

La porta predefinita del server locale è **8888**. Per usarne un'altra imposta la variabile `TRADERMON_PORT`, ad esempio `TRADERMON_PORT=9000 npm start` (su Windows PowerShell: `$env:TRADERMON_PORT=9000; npm start`). Vale anche per `npm run dev`.

Il gioco è una PWA: dal browser si può "installare" e giocare anche offline. Le funzioni Alpaca richiedono il server locale e la rete.

## Giocatore e salvataggi (Supabase)

Al primo avvio, prima del tutorial, il gioco chiede di creare un **giocatore**: un nome unico (3-15 caratteri, nessun altro può usarlo, maiuscole comprese) e una password di almeno 8 caratteri. Chi ha già un giocatore sceglie *Ho già un giocatore* ed entra con nome e password da qualsiasi browser o dispositivo.

- La partita (tutto l'oggetto di gioco: posizione, storia, portafoglio, opzioni) è salvata su **Supabase**, tabella `saves`, una riga per giocatore. Il gioco la invia a ogni salvataggio (pulsante, menu, entrata e uscita dagli edifici, dopo ogni sfida) e il tempo di gioco ogni minuto.
- Sul dispositivo resta solo una copia di lavoro: serve a giocare senza rete. Quello che salvi offline parte appena torna la connessione.
- Le **chiavi Alpaca** restano sul server locale come prima. In più ne va una copia su Supabase (tabella `alpaca_keys`), **cifrata nel browser** con AES-256-GCM. La chiave che la apre è derivata dalla password del giocatore (PBKDF2-SHA256, 600.000 iterazioni) e non lascia mai il dispositivo: sul server ci sono solo dati illeggibili, anche per chi amministra il database. Su un altro computer il gioco le ripristina nel server locale dopo aver chiesto la password.
- Non c'è un'email collegata, quindi **la password non si recupera**: se la dimentichi, la partita resta su Supabase ma non puoi rientrare.
- *Opzioni → Esci dal giocatore* toglie la sessione e la copia locale da questo dispositivo (la partita resta online). *Esporta salvataggio* scarica comunque un file JSON.
- Le partite fatte prima di questo aggiornamento restano nel browser: al primo accesso il gioco chiede se portarle nel giocatore.

Configurazione: `src/config/supabase.ts` contiene l'indirizzo del progetto e la chiave **pubblica** (publishable), che può stare nel codice perché la protezione è data dalle regole RLS. Per un altro progetto imposta `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` in fase di build. Lo schema è in `supabase/migrations/`, la funzione di registrazione in `supabase/functions/registra-giocatore/`.

## Come si gioca

| Azione | Tastiera | Touch |
|---|---|---|
| Muoversi | Frecce o WASD | Croce direzionale |
| Conferma / parla | Z, Invio, Spazio | A |
| Indietro | X, Esc | B |
| Menu | M | MENU |

All'inizio un mini tutorial fa provare i comandi, con la versione per tastiera o per touch a seconda del dispositivo. Si riapre da *Menu → Opzioni → Comandi*. Nelle finestre, le frecce spostano la selezione e Z/A conferma.

1. All'inizio crei il tuo giocatore (nome e password); il Prof. Saldi ti chiama con quel nome e ti chiede l'aspetto. Poi fai un breve questionario sul profilo di rischio.
2. Nel Laboratorio scegli una delle tre Valigette: Titoli (azioni), Indici (ETF) o Cripto. Parlando con il Prof puoi scegliere anche il Sentiero Misto.
3. La **difficoltà** scelta all'inizio fissa il capitale del **conto di gioco** e non si cambia più: Apprendista 10.000 $, Investitore 5.000 $, Stratega 2.500 $, Leggenda 1.000 $ (con costi didattici e tolleranze sempre più strette). La Dott.ssa Ratio apre il conto: è un registro dentro il tuo conto Alpaca Paper, e cambia solo con gli ordini inviati dal gioco, ai prezzi veri di esecuzione.
4. Il capitale si libera a **rate**: il 10% con la Valigetta e un altro 10% a ogni Attestato; il resto sta nella Riserva dell'Accademia fino alla Lega. Ogni tappa ha un **esercizio** sul conto (versare la rata usando la Tecnica appena imparata). Gli ordini si possono inviare anche a mercato chiuso: Alpaca li esegue all'apertura.
5. Ogni **Medaglia** ha due metà. L'**Attestato** si vince con il duello di conoscenza del Mentore e apre la strada. Il **Sigillo pratico** chiede una missione nella **Macchina del Tempo** (un periodo vero di mercato, con i nomi dei titoli nascosti fino alla fine) e l'esercizio della tappa sul conto. Per entrare nella Lega servono tutti e otto i Sigilli.
6. Dal 5º Attestato si può sostenere l'**Esame della Leva**: vale subito nei replay e, dall'8º Attestato, anche sul conto di gioco (massimo 2×, solo azioni ed ETF), con interessi, chiamata di margine e bancarotta. Dopo la Lega: aumento del capitale, crisi leggendarie e tre **Boss dei Mercati** (quiz, poi un solo piano su un grafico vero, valutato dopo ore o settimane).
7. Entra nelle case: ogni abitante (single, coppie, famiglie) ti insegna un concetto diverso, che resta annotato nell'Investidex.
8. Nelle Cliniche del Portafoglio salvi, fai il check-up, la diagnosi e il ribilanciamento, e impari a riconoscere i bias.
9. L'erba alta è solo decorativa: non ci sono incontri casuali né stati alterati.
10. Dal menu, l'**Agenda** propone tre missioni al giorno e una alla settimana (leggere, vincere duelli, fare il check-up, camminare...). Completarle dà solo punti Conoscenza. I **traguardi** sbloccano titoli (da mostrare nel profilo e nei duelli) e oggetti con cui si arreda la casa a Borgo Semina.
11. Gli investitori battuti chiedono la **rivincita** dopo tre giorni, con domande più difficili. Alcuni abitanti, alla seconda visita, raccontano una **storia a tappe** (sei in tutto) che porta a parlare con altri, leggere una lezione o superare una prova.
12. Dopo ogni acquisto o vendita il **Diario dell'investitore** chiede il perché; dopo 30 giorni propone di rileggerlo con il senno di poi. In Biblioteca e in Zona Simulazione ci sono quattro **minigiochi** (grafici, interesse composto, diversificazione, bilanci), gli **scenari storici** spiegati e la **sfida della settimana** con classifica locale e codice da scambiare con gli amici.
13. Il clima di mercato si vede anche nel cielo: pioggia con l'orso, temporale con lampi nella tempesta, scintille con il toro, lucciole e finestre accese di notte. La musica è chiptune originale, generata in codice, e cambia con il luogo, la notte, i duelli e il clima.

## Conto Alpaca: Paper per giocare, reale facoltativo

Le chiavi **non sono mai nel codice né nel salvataggio**. Si inseriscono nel gioco dal menu, voce **Chiavi API** (c'è anche in Clinica). Su Supabase ne resta solo una copia cifrata con la tua password (vedi sopra).

1. Crea un account su [alpaca.markets](https://alpaca.markets) e genera le chiavi **Paper** dalla dashboard.
2. Nel gioco scegli *Collega Alpaca Paper* e incolla Key ID e Secret.
3. Il server locale verifica le chiavi presso Alpaca. Poi le salva solo sul tuo computer, in `server/.secrets/keys.json` (permessi 600, escluso da git).
4. Il conto **reale** si sblocca dopo il 1º Attestato e l'Esame di Abilitazione (9 risposte giuste su 10). Ogni ordine reale:
   - chiede di scrivere `CONFERMO`;
   - rispetta i limiti per ordine e per mese, che crescono con gli Attestati;
   - viene annotato in `server/.secrets/audit.log`.

Le vendite allo scoperto non sono ammesse. La progressione del gioco vive solo sul Paper: nessun premio dipende dal denaro vero. Sul conto reale i prelievi si fanno sempre dal sito di Alpaca e i depositi non passano mai dal gioco.

I dati di Alpaca non si possono ridistribuire: ogni giocatore li scarica con le proprie chiavi e nel repository non c'è alcun prezzo storico. Per controllare che i periodi usati da missioni e crisi abbiano dati per tutti i titoli: `npm start` e, in un altro terminale, `node scripts/check-windows.mjs`. I test automatici usano un finto Alpaca locale con prezzi generati (`tests/helpers/fake-alpaca.ts`). Puoi abbassare il tetto massimo per ordine con la variabile `TRADERMON_LIVE_MAX_ORDER`, che vale 2500 dollari se non la imposti. Puoi attivare una pausa di riflessione di 1, 7 o 30 giorni. Depositi e prelievi si fanno sempre dalla dashboard di Alpaca.

## Struttura

- `docs/01-GDD.md`: il piano dettagliato del gioco (meccaniche, mondo, missioni, sicurezza).
- `docs/02-CONTENUTI-E-FONTI.md`: domande, lezioni e fonti citate (generato con `npm run docs:content`).
- `docs/03-ARCHITETTURA.md`: come è fatto il codice.
- `src/`: il gioco (TypeScript, Phaser 4).
- `src/render3d/`: la resa 2.5D "HD-2D" del mondo (Three.js): diorama con case, muri e oggetti in rilievo ricavati dalla pixel art, personaggi come sprite in piedi, ombre, luci di notte e post-produzione (occlusione ambientale, bagliore, tilt-shift). Si attiva/disattiva da Menu → Opzioni → Grafica (2.5D o 2D classica) con un livello di effetti per i computer meno potenti.
- `src/proto/hd2d.ts` + `hd2d.html`: pagina di prova dello stesso motore 2.5D con camera libera (`/hd2d.html?map=t0&x=11&y=9`, parametri `map`, `x`, `y`, `dist`, `tilt`, `night`, `fx`).
- `public/assets3d/`: facoltativo, modelli `.glb` esterni che sostituiscono gli oggetti generati (vedi il README nella cartella). `npm run assets:ai` genera immagini o modelli con servizi che hanno un piano gratuito (Pollinations, Meshy) usando le tue chiavi.
- `server/index.mjs`: il server locale che serve il gioco e fa da tramite verso Alpaca.
- `tests/`: i test automatici (`npm test`).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Sviluppo con ricarica automatica |
| `npm run build` | Controllo dei tipi e build in `dist/` |
| `npm start` | Server di produzione su 127.0.0.1:8888 |
| `npm test` | Test di dati, mappe, portafoglio, server, agenda, storie e sfide |
| `npm run docs:content` | Rigenera il documento dei contenuti |
| `npm run assets:ai image\|model "descrizione" file` | Genera una risorsa grafica con Pollinations (immagine) o Meshy (modello 3D, chiave `MESHY_API_KEY`) in `public/assets3d/` |

## Fonti didattiche

I quiz si basano su materiale pubblico di SEC Investor.gov, Investopedia, Banca d'Italia (Economia per tutti), Consob, CFA Institute ed ESMA. L'elenco completo con i link è in `docs/02-CONTENUTI-E-FONTI.md`.
