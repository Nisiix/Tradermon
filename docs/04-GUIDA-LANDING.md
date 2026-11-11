# Guida per la landing page (sezione `#guida`)

Testo pronto da inserire nella sezione Guida della landing. Il gioco rimanda qui dalla voce "Chiavi API" e dalla Guida interna (`src/ui/broker.ts`, `GUIDE_LINES`): se una regola cambia, vanno aggiornati tutti e due.

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

### La Lega

Ogni Superiore ti sfida a un duello di conoscenza e poi guarda il tuo conto com'è adesso: quanto è investito, come è diviso tra i titoli, se è protetto da ordini stop, se somiglia al piano che ti sei dato. **Nessuno ti chiede un rendimento**: si giudica il metodo. Se la verifica non riesce, operi e la ripeti senza rifare il duello. Contano gli ordini eseguiti, quindi a mercato chiuso può servire aspettare l'apertura.

I periodi veri del passato si rivivono solo nella Macchina del Tempo (la Zona Simulazione di Diversia) e nelle crisi leggendarie della Torre: sono facoltativi e non contano per Sigilli e Lega.

### Dopo la Lega

Aumenti di capitale, crisi leggendarie, Torre delle Sfide e tre Boss dei Mercati. La **Nuova Partita+** riparte da zero (conto, Attestati e Sigilli si riguadagnano) conservando solo i trofei, e sblocca la difficoltà Leggenda.

## Come collegare Alpaca

1. Crea un account su alpaca.markets: per il conto Paper basta l'email.
2. Nella dashboard, in modalità Paper, genera una coppia di chiavi API (Key ID e Secret).
3. Nel gioco apri il menu, voce **Chiavi API**, e inseriscile. Restano sul server locale di Tradermon, sul tuo computer; il gioco non le mostra più.

### Conto reale (facoltativo)

- Si collega dopo il primo Attestato e l'Esame di Abilitazione, con chiavi Live distinte. È fuori dalla storia: nessun premio di gioco dipende dal denaro vero. Potrebbe non essere disponibile in tutti i Paesi: lo decide Alpaca.
- **I prelievi si possono sempre fare**, dal sito di Alpaca. **I depositi non passano mai dal gioco**: Tradermon non sposta denaro e non ti chiederà mai di versarne.
- Ogni ordine reale chiede una conferma scritta e rispetta i tuoi limiti per ordine e per mese.
- La bancarotta esiste anche qui: se il conto arriva a zero, il gioco ferma gli acquisti dal suo sportello (per 7 giorni, per 30 o per sempre, secondo la difficoltà). Vendere e prelevare resta sempre possibile.
- Il conto è in dollari. Chi risiede in Italia e usa un broker estero deve dichiarare conto e redditi.

Tradermon è un gioco educativo e non fornisce consulenza finanziaria.
