# Guida per la landing page (sezione `#guida`)

Testo della sezione Guida della landing (`index.html`, schede `g-...`). Il gioco rimanda qui dalla voce "Chiavi API" e dalla Guida interna (`src/ui/broker.ts`, `GUIDE_LINES`): se una regola cambia, vanno aggiornati tutti e due.

## Come si gioca

Tradermon è un gioco di ruolo per imparare a investire. Si studia, si sfidano gli altri investitori a quiz e si opera su titoli veri con denaro finto, attraverso un conto Alpaca Paper.

### Attestati e Sigilli: la regola da sapere prima di partire

In ogni città c'è un Mentore, e la sua Medaglia ha due metà.

- **L'Attestato** si vince con un duello di conoscenza. Basta l'Attestato per proseguire verso la città successiva.
- **Il Sigillo pratico** si guadagna con la **Prova sul conto**: ordini veri sul mercato di oggi, dal tuo conto di gioco, usando la Tecnica che il Mentore ti ha appena insegnato.

Puoi viaggiare con i soli Attestati, ma **nella Lega degli Investitori entra solo chi ha tutti e otto i Sigilli**. Studiare apre la strada; saper fare apre la Lega.

### Il conto di gioco

- Serve un conto **Alpaca Paper**: gratuito, basta un'email, denaro finto con prezzi e orari veri. Senza conto puoi comunque studiare tutto e vincere gli Attestati, ma non i Sigilli e la Lega.
- La **difficoltà** si sceglie all'inizio, fissa il capitale e non si cambia: Apprendista 10.000 $, Investitore 5.000 $, Stratega 2.500 $. La quarta, **Leggenda** (1.000 $), si sblocca con la Nuova Partita+.
- **Tutto il capitale è tuo dal primo giorno.** Ogni tappa ti chiede solo una quota minima da investire (dal 5% del capitale per tappa in Apprendista al 9,5% in Leggenda). Sopra il minimo decidi tu.
- Gli ordini sono per importo in dollari: compri anche una **frazione** di titolo, a mercato, con limite o con stop.
- Puoi ordinare anche a mercato chiuso: l'ordine parte lo stesso e Alpaca lo esegue all'apertura. Le cripto si scambiano sempre.
- I **dividendi** nel gioco sono solo teoria: si studiano, ma nessuna prova pratica li richiede e il conto Paper non li paga.

### Bancarotta

È bancarotta quando il conto arriva a **zero**, in ogni difficoltà. Le quote di tappa sono importi fissi, calcolati sul capitale di partenza e non su quello che ti resta: se perdi, pesano di più. Chi opera con metodo arriva alla Lega con capitale in tasca; quanti errori ti puoi permettere dipende dalla difficoltà. In Apprendista e Investitore si riparte con metà del capitale di partenza; in Stratega una volta sola; in Leggenda la parte pratica finisce.

Al conto a zero si arriva in due modi: usando la **leva**, oppure **vendendo in perdita**. Finché tieni un titolo la perdita è sulla carta; quando lo vendi diventa vera e il capitale non torna. Vale per le vendite fatte nel gioco e per quelle fatte fuori, per esempio dal sito di Alpaca: alla sincronizzazione successiva il gioco se ne accorge, le registra al prezzo vero di esecuzione e aggiorna conto, perdite realizzate e controllo della bancarotta.

Se in una prova sul conto non riesci ad arrivare all'obiettivo con un titolo, puoi venderlo, anche solo in parte, e puntare su un altro.

### La Lega

Ogni Superiore ti sfida a un duello di conoscenza e poi guarda il tuo conto com'è adesso: quanto è investito, come è diviso tra i titoli, se è protetto da ordini stop, se somiglia al piano che ti sei dato. **Nessuno ti chiede un rendimento**: si giudica il metodo. Se la verifica non riesce, operi e la ripeti senza rifare il duello. Contano gli ordini eseguiti, quindi a mercato chiuso può servire aspettare l'apertura.

I periodi veri del passato si rivivono solo nella Macchina del Tempo (la Zona Simulazione di Diversia) e nelle crisi leggendarie della Torre: sono facoltativi e non contano per Sigilli e Lega.

### Dopo la Lega

Aumenti di capitale, crisi leggendarie, Torre delle Sfide e tre Boss dei Mercati. Con un Boss presenti un piano su un titolo vero: ingresso, stop e obiettivo. Se vedi che l'obiettivo non arriva puoi **vendere prima della scadenza**, anche solo una parte: la decisione di vendere annulla la sfida, che si ripete da capo con un titolo diverso. Non conta come sconfitta.

La **Nuova Partita+** riparte da zero (conto, Attestati e Sigilli si riguadagnano) conservando solo i trofei, e sblocca la difficoltà Leggenda.

## Come collegare Alpaca

1. Crea un account su alpaca.markets: per il conto Paper basta l'email.
2. Nella dashboard, in modalità Paper, genera una coppia di chiavi API (Key ID e Secret).
3. Nel gioco apri il menu, voce **Chiavi API**, e inseriscile.

**Se giochi dal sito**, le chiavi Paper vengono cifrate nel tuo browser con la password del giocatore e su Supabase resta solo la copia cifrata, illeggibile anche per chi amministra il database. Quando operi, il gioco la apre sul tuo dispositivo e manda le chiavi, su connessione cifrata, alla funzione di Tradermon su Supabase: questa le usa per parlare con Alpaca e non le salva.

**Se giochi sul tuo computer**, le chiavi restano sul server locale di Tradermon e il gioco non le mostra più.

### Dove funziona la parte pratica

Gli ordini non partono mai direttamente dalla pagina verso Alpaca: passano sempre da un intermediario di Tradermon che applica le regole del gioco (niente vendite allo scoperto, acquisti entro la liquidità).

- **Sul sito** funziona tutta la storia: studio, Attestati, prove sul conto, Sigilli, Lega e Boss. Serve essere entrati con il proprio giocatore e aver collegato il conto **Paper**. Gli ordini passano da Supabase. Il conto reale sul sito non c'è.
- **Sul tuo computer** funziona tutto, anche il conto reale: scarica il progetto da GitHub, installa Node.js 20 o più recente, poi nella cartella esegui `npm install`, `npm run build` e `npm start`, e apri l'indirizzo che compare.

### Conto reale (facoltativo)

- Si usa **solo giocando sul tuo computer**: le chiavi Live restano sul server locale e non passano mai dal sito.
- Si collega dopo il primo Attestato e l'Esame di Abilitazione, con chiavi Live distinte. È fuori dalla storia: nessun premio di gioco dipende dal denaro vero. Potrebbe non essere disponibile in tutti i Paesi: lo decide Alpaca.
- **I prelievi si possono sempre fare**, dal sito di Alpaca. **I depositi non passano mai dal gioco**: Tradermon non sposta denaro e non ti chiederà mai di versarne.
- Ogni ordine reale chiede una conferma scritta e rispetta i tuoi limiti per ordine e per mese.
- La bancarotta esiste anche qui: se il conto arriva a zero, il gioco ferma gli acquisti dal suo sportello (per 7 giorni, per 30 o per sempre, secondo la difficoltà). Vendere e prelevare resta sempre possibile.
- Il conto è in dollari. Chi risiede in Italia e usa un broker estero deve dichiarare conto e redditi.

Tradermon è un gioco educativo e non fornisce consulenza finanziaria.
