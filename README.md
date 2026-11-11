# Tradermon · Il viaggio dell'investitore

Tradermon è un gioco di ruolo educativo sugli investimenti, nello stile dei giochi per console portatili dei primi anni 2000. Il mondo, i personaggi e la grafica sono originali. Ci si muove su una mappa, si sfidano gli altri investitori con quiz di finanza e si superano missioni di trading su periodi veri di mercato. Si sconfiggono 8 Mentori, poi si affronta la Lega degli Investitori. Titoli, prezzi e grafici sono reali: arrivano da Alpaca, con le chiavi del giocatore. Nel gioco non esistono titoli o andamenti inventati.

> **Non è consulenza finanziaria.** Tutto il gioco si completa con denaro finto, su un conto Alpaca **Paper** (gratuito, basta un'email). Senza conto collegato resta aperto tutto il percorso di studio (storia, duelli, biblioteche, Attestati), ma non la parte pratica (Sigilli, Lega, grafici e titoli reali). Il collegamento a un conto reale (Live) è facoltativo, fuori dalla storia, si sblocca solo dopo il primo Attestato e un esame, ed è limitato da tetti prudenti.

## Avvio rapido

Serve Node.js 20 o più recente.

```bash
npm install
npm run dev        # landing su http://localhost:5173, gioco su /gioca/ + server locale Alpaca su 127.0.0.1:8888
```

Versione di produzione (un solo processo, nessuna dipendenza a runtime):

```bash
npm run build
npm start          # apri http://localhost:8888 (landing) oppure http://localhost:8888/gioca/ (gioco)
```

Il sito ha due pagine: la **landing** (`index.html`, codice in `landing/`) con la Guida completa nella sezione `#guida`, e il **gioco** (`gioca/index.html`). Gli indirizzi per le donazioni in crypto si inseriscono in `landing/config/donazioni.json` (istruzioni in `landing/config/README.md`); se la lista è vuota il pulsante non compare.

La porta predefinita del server locale è **8888**. Per usarne un'altra imposta la variabile `TRADERMON_PORT`, ad esempio `TRADERMON_PORT=9000 npm start` (su Windows PowerShell: `$env:TRADERMON_PORT=9000; npm start`). Vale anche per `npm run dev`.

Il gioco è una PWA: dal browser si può "installare" e giocare anche offline. Le funzioni Alpaca richiedono la rete. Sul tuo computer passano dal server locale di Tradermon; dal sito pubblico è il browser a parlare direttamente con Alpaca (Paper e conto reale), con le chiavi custodite solo sul dispositivo: serve essere entrati con il proprio giocatore.

## Giocatore e salvataggi (Supabase)

Al primo avvio, prima del tutorial, il gioco chiede di creare un **giocatore**: un nome unico (3-15 caratteri, nessun altro può usarlo, maiuscole comprese) e una password di almeno 8 caratteri. Chi ha già un giocatore sceglie *Ho già un giocatore* ed entra con nome e password da qualsiasi browser o dispositivo.

- La partita (tutto l'oggetto di gioco: posizione, storia, portafoglio, opzioni) è salvata su **Supabase**, tabella `saves`, una riga per giocatore. Il gioco la invia a ogni salvataggio (pulsante, menu, entrata e uscita dagli edifici, dopo ogni sfida) e il tempo di gioco ogni minuto.
- Sul dispositivo resta solo una copia di lavoro: serve a giocare senza rete. Quello che salvi offline parte appena torna la connessione.
- Le **chiavi Alpaca** restano **solo sul dispositivo del giocatore**, mai su Supabase e mai nel salvataggio. Giocando sul proprio computer le custodisce il server locale. Giocando dal sito pubblico sono salvate nel browser (`localStorage`), **cifrate** con AES-256-GCM: la chiave che le apre nasce dalla password del giocatore (PBKDF2-SHA256, 600.000 iterazioni), vive nel browser in forma non estraibile e non lascia mai il dispositivo. Il browser le tiene in memoria per la sessione e le invia soltanto ad Alpaca, su connessione cifrata. Su un altro dispositivo vanno inserite di nuovo; cancellando i dati del sito si perdono e si rigenerano dalla dashboard di Alpaca. Le copie cifrate che le versioni precedenti tenevano su Supabase (tabella `alpaca_keys`) vengono portate sul dispositivo al primo accesso e cancellate.
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
3. La **difficoltà** scelta all'inizio fissa il capitale del **conto di gioco** e non si cambia più: Apprendista 10.000 $, Investitore 5.000 $, Stratega 2.500 $, Leggenda 1.000 $ (con costi didattici e quote minime sempre più strette). **Leggenda è bloccata nella prima partita** e si sblocca con la Nuova Partita+. La Dott.ssa Ratio apre il conto: è un registro dentro il tuo conto Alpaca Paper, e cambia solo con gli ordini inviati dal gioco, ai prezzi veri di esecuzione.
4. **Tutto il capitale è investibile dal primo giorno.** Ogni tappa chiede solo una **quota minima** da investire, cumulata: 5% del capitale per tappa in Apprendista, 7% in Investitore, 8,5% in Stratega, 9,5% in Leggenda. Sopra il minimo il giocatore investe quanto vuole. Gli ordini sono per importo in dollari, quindi anche **frazionati** (a mercato, limite e stop), e si possono inviare a mercato chiuso: Alpaca li esegue all'apertura.
5. Ogni **Medaglia** ha due metà. L'**Attestato** si vince con il duello di conoscenza del Mentore e basta per proseguire verso la città successiva. Il **Sigillo pratico** si guadagna con la **Prova sul conto**: ordini veri sul mercato di oggi, dal conto di gioco, investendo la quota della tappa con la Tecnica appena imparata. Per entrare nella Lega servono tutti e otto i Sigilli. La regola è spiegata dal Professore all'inizio, dalla Dott.ssa Ratio all'apertura del conto e nella Guida (voce "Chiavi API"). **Vendere annulla la sfida**: decidere di vendere un titolo comprato per la Prova in corso, anche solo una parte, annulla la Prova (il gioco lo chiede in modo esplicito prima della vendita); la quota della tappa riparte da zero e si rifà con un altro titolo. Vale anche per uno stop che scatta, per le vendite fatte dal sito di Alpaca, per la vendita forzata della leva, per la bancarotta e per i mandati dei Boss. In Apprendista e Investitore l'opzione "Prove sul conto: prosegui anche se vanno male" (Impostazioni ⚙ oppure Menu, Opzioni) ignora l'esito negativo di una Prova e lascia proseguire: non la salta, ed è sconsigliata a chi vuole imparare.
6. I replay di periodi veri del passato vivono solo nella **Macchina del Tempo** (Zona Simulazione di Diversia: missioni facoltative, periodi liberi, crisi storiche) e nelle **crisi leggendarie** della Torre. I Mentori non propongono replay, e Sigilli e Lega non ne dipendono. Nella **Lega** ogni Superiore guarda il conto di gioco com'è adesso (quanto è investito, come è diviso, se è protetto da stop, se segue il piano) e non chiede mai un rendimento. Chi non supera la verifica opera e la ripete, senza rifare il duello.
7. **Bancarotta**: quando il conto arriva a **zero** (sotto 1 $, il minimo per un ordine), in ogni difficoltà. Le quote di tappa sono importi fissi calcolati sul **capitale di partenza**, non sul patrimonio del momento: chi perde le finanzia sempre più a fatica, chi opera con metodo arriva alla Lega con capitale in tasca. Quanti errori sono concessi lo decide la difficoltà. Apprendista e Investitore ripartono con metà del capitale di partenza, Stratega una volta sola, in Leggenda la parte pratica finisce. Vale anche sul **conto reale**: se arriva a zero il gioco ferma gli acquisti dal suo sportello (7 giorni, 30 giorni o per sempre, secondo la difficoltà). Vendere e prelevare resta sempre possibile. Al conto a zero si arriva con la **leva** oppure con le **perdite realizzate**: una vendita in perdita fatta nel gioco, oppure fatta fuori (dal sito di Alpaca), che il gioco riconosce alla sincronizzazione, registra al prezzo vero di esecuzione letto dagli ordini chiusi di Alpaca e somma al risultato realizzato (Cartella clinica) prima di ricontrollare la bancarotta. Nelle prove sul conto, se con un titolo non si arriva all'obiettivo, si può vendere (anche in parte) e puntare su un altro; nei mandati dei Boss la decisione di vendere annulla la sfida, che si ripete da capo con un titolo diverso.
8. Dal 5º Attestato si può sostenere l'**Esame della Leva**: vale subito nei replay e, dall'8º Attestato, anche sul conto di gioco (massimo 2×, solo azioni ed ETF), con interessi e chiamata di margine. I **dividendi** sono solo teoria (libri e duelli): nessuna prova pratica li usa, e il conto Paper non li paga.
9. Dopo la Lega: aumento del capitale, crisi leggendarie e tre **Boss dei Mercati** (quiz, poi un solo piano su un grafico vero, valutato dopo ore o settimane). La **Nuova Partita+** riparte da zero (conto, Attestati, Sigilli, Prove, leva, accesso a Torre e Boss) conservando solo i trofei: record della Torre, crisi leggendarie, Boss battuti, carte dorate, traguardi, titolo, arredi e Diario.
10. Entra nelle case: ogni abitante (single, coppie, famiglie) ti insegna un concetto diverso, che resta annotato nell'Investidex.
11. Nelle Cliniche del Portafoglio salvi, fai il check-up, la diagnosi e il ribilanciamento, e impari a riconoscere i bias.
12. L'erba alta è solo decorativa: non ci sono incontri casuali né stati alterati.
13. Dal menu, l'**Agenda** propone tre missioni al giorno e una alla settimana (leggere, vincere duelli, fare il check-up, camminare...). Completarle dà solo punti Conoscenza. I **traguardi** sbloccano titoli (da mostrare nel profilo e nei duelli) e oggetti con cui si arreda la casa a Borgo Semina.
14. Gli investitori battuti chiedono la **rivincita** dopo tre giorni, con domande più difficili. Alcuni abitanti, alla seconda visita, raccontano una **storia a tappe** (sei in tutto) che porta a parlare con altri, leggere una lezione o superare una prova.
15. Dopo ogni acquisto o vendita il **Diario dell'investitore** chiede il perché; dopo 30 giorni propone di rileggerlo con il senno di poi. In Biblioteca e in Zona Simulazione ci sono quattro **minigiochi** (grafici, interesse composto, diversificazione, bilanci), gli **scenari storici** spiegati e la **sfida della settimana** con classifica locale e codice da scambiare con gli amici.
16. Il clima di mercato si vede anche nel cielo: pioggia con l'orso, temporale con lampi nella tempesta, scintille con il toro, lucciole e finestre accese di notte. La musica è chiptune originale, generata in codice, e cambia con il luogo, la notte, i duelli e il clima.

## Conto Alpaca: Paper per giocare, reale facoltativo

Le chiavi **non sono mai nel codice né nel salvataggio**. Si inseriscono nel gioco dal menu, voce **Chiavi API** (c'è anche in Clinica). Restano solo sul tuo dispositivo (vedi sopra): prima di inserirle il gioco mostra un avviso che spiega dove restano, a chi vengono inviate e che cosa comporta.

1. Crea un account su [alpaca.markets](https://alpaca.markets) e genera le chiavi **Paper** dalla dashboard.
2. Nel gioco scegli *Collega Alpaca Paper* e incolla Key ID e Secret.
3. Sul tuo computer il server locale verifica le chiavi presso Alpaca e le salva solo lì, in `server/.secrets/keys.json` (permessi 600, escluso da git). Dal sito pubblico le verifica il browser, leggendo il conto direttamente da Alpaca, e le salva cifrate sul dispositivo.
   - Dal sito funziona tutto: la parte pratica della storia (Prove, Sigilli, Lega, Boss) sul conto Paper e, per chi lo vuole, il conto reale. La pagina pubblicata ha una Content-Security-Policy: esegue solo il codice del gioco e può chiamare solo Alpaca e il servizio dei salvataggi.
   - Se il browser non riesce a raggiungere Alpaca (rete o blocco di contenuti), il gioco chiede se far passare il **solo conto Paper** dalla funzione Supabase `alpaca`, che usa le chiavi per quella richiesta e non le salva. È una scelta del giocatore, vale per quel dispositivo e si può ritirare. Le chiavi Live non seguono mai quella strada.
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
- `supabase/functions/alpaca/`: `core.js` contiene le regole e le rotte sugli ordini, condivise da server locale, browser (collegamento diretto del sito) e funzione Edge. La funzione Edge è la riserva del sito, solo Paper e solo se il giocatore la sceglie: `index.ts` aggiunge accesso del giocatore, CORS e limite di richieste. Si pubblica con `supabase functions deploy alpaca --no-verify-jwt` (la funzione verifica da sé il token del giocatore).
- `supabase/functions/registra-giocatore/`, `supabase/functions/elimina-giocatore/` e `supabase/migrations/`: registrazione e cancellazione dei giocatori, tabelle.
- `privacy/index.html`: informativa sulla privacy.
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
