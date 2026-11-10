# Tradermon · Il viaggio dell'investitore

Tradermon è un gioco di ruolo educativo sugli investimenti, nello stile dei giochi per console portatili dei primi anni 2000. Il mondo, i personaggi e la grafica sono originali. Ci si muove su una mappa, si sfidano gli altri investitori con quiz di finanza e si superano missioni di trading in un mercato simulato. Si sconfiggono 8 Mentori, poi si affronta la Lega degli Investitori.

> **Non è consulenza finanziaria.** Tutto il gioco si completa con denaro finto. Il collegamento a un conto reale (Alpaca) è facoltativo, si sblocca solo dopo la prima Medaglia e un esame, ed è limitato da tetti prudenti.

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

## Come si gioca

| Azione | Tastiera | Touch |
|---|---|---|
| Muoversi | Frecce o WASD | Croce direzionale |
| Conferma / parla | Z, Invio, Spazio | A |
| Indietro | X, Esc | B |
| Menu | M | MENU |

All'inizio un mini tutorial fa provare i comandi, con la versione per tastiera o per touch a seconda del dispositivo. Si riapre da *Menu → Opzioni → Comandi*. Nelle finestre, le frecce spostano la selezione e Z/A conferma.

1. All'inizio il Prof. Saldi ti chiede nome e aspetto. Poi fai un breve questionario sul profilo di rischio.
2. Nel Laboratorio scegli una delle tre Valigette: Titoli (azioni), Indici (ETF) o Cripto. Parlando con il Prof puoi scegliere anche il Sentiero Misto.
3. La Dott.ssa Ratio apre il tuo **Conto di Prova**. Scegli il capitale virtuale e l'allocazione obiettivo. Il gioco non aggiunge né toglie mai denaro da solo: il conto cambia solo con le tue operazioni e con il mercato.
4. Ogni Mentore si batte in due fasi: un duello di conoscenza e una missione nella **Macchina del Tempo**, un mercato simulato con ordini, costi, dividendi e notizie.
5. Entra nelle case: ogni abitante (single, coppie, famiglie) ti insegna un concetto diverso, che resta annotato nell'Investidex.
6. Nelle Cliniche del Portafoglio salvi, fai il check-up, la diagnosi e il ribilanciamento, e impari a riconoscere i bias.
7. L'erba alta è solo decorativa: non ci sono incontri casuali né stati alterati.
8. Dal menu, l'**Agenda** propone tre missioni al giorno e una alla settimana (leggere, vincere duelli, fare il check-up, camminare...). Completarle dà solo punti Conoscenza. I **traguardi** sbloccano titoli (da mostrare nel profilo e nei duelli) e oggetti con cui si arreda la casa a Borgo Semina.
9. Gli investitori battuti chiedono la **rivincita** dopo tre giorni, con domande più difficili. Alcuni abitanti, alla seconda visita, raccontano una **storia a tappe** (sei in tutto) che porta a parlare con altri, leggere una lezione o superare una prova.
10. Dopo ogni acquisto o vendita il **Diario dell'investitore** chiede il perché; dopo 30 giorni propone di rileggerlo con il senno di poi. In Biblioteca e in Zona Simulazione ci sono quattro **minigiochi** (grafici, interesse composto, diversificazione, bilanci), gli **scenari storici** spiegati e la **sfida della settimana** con classifica locale e codice da scambiare con gli amici.
11. Il clima di mercato si vede anche nel cielo: pioggia con l'orso, temporale con lampi nella tempesta, scintille con il toro, lucciole e finestre accese di notte. La musica è chiptune originale, generata in codice, e cambia con il luogo, la notte, i duelli e il clima.

## Conto reale Alpaca (facoltativo)

Le chiavi **non sono mai nel codice né nel salvataggio**. Si inseriscono nel gioco: *Clinica → Conto Alpaca*.

1. Crea un account su [alpaca.markets](https://alpaca.markets) e genera le chiavi **Paper** dalla dashboard.
2. Nel gioco scegli *Collega Alpaca Paper* e incolla Key ID e Secret.
3. Il server locale verifica le chiavi presso Alpaca. Poi le salva solo sul tuo computer, in `server/.secrets/keys.json` (permessi 600, escluso da git).
4. Il conto **reale** si sblocca dopo la 1ª Medaglia e l'Esame di Abilitazione (9 risposte giuste su 10). Ogni ordine reale:
   - chiede di scrivere `CONFERMO`;
   - rispetta i limiti per ordine e per mese, che crescono con le Medaglie;
   - viene annotato in `server/.secrets/audit.log`.

Vendite allo scoperto e margine non sono ammessi. Puoi abbassare il tetto massimo per ordine con la variabile `TRADERMON_LIVE_MAX_ORDER`, che vale 2500 dollari se non la imposti. Puoi attivare una pausa di riflessione di 1, 7 o 30 giorni. Depositi e prelievi si fanno sempre dalla dashboard di Alpaca.

## Struttura

- `docs/01-GDD.md`: il piano dettagliato del gioco (meccaniche, mondo, missioni, sicurezza).
- `docs/02-CONTENUTI-E-FONTI.md`: domande, lezioni e fonti citate (generato con `npm run docs:content`).
- `docs/03-ARCHITETTURA.md`: come è fatto il codice.
- `src/`: il gioco (TypeScript, Phaser 4).
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

## Fonti didattiche

I quiz si basano su materiale pubblico di SEC Investor.gov, Investopedia, Banca d'Italia (Economia per tutti), Consob, CFA Institute ed ESMA. L'elenco completo con i link è in `docs/02-CONTENUTI-E-FONTI.md`.
