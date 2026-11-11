# Guida per la landing page (sezione `#guida`)

Testo della sezione Guida della landing (`index.html`, schede `g-...`). Sulla landing la Guida è volutamente breve: le regole complete (bancarotta, Prove sul conto, Lega, Boss) le spiegano i personaggi dentro il gioco e la Guida interna (`src/ui/broker.ts`, `GUIDE_LINES`). Se una regola cambia, controlla che queste righe restino vere.

Regola dei testi: nelle pagine e nel gioco non si nominano gli strumenti dietro le quinte (servizio dei salvataggi, hosting, Node e simili). L'unico servizio esterno nominato è Alpaca, perché il giocatore deve crearsi il conto Paper. Fa eccezione l'informativa sulla privacy, che per legge deve dire chi tratta i dati.

### Un gioco per imparare (sezione `#imparare`, tre colonne)

- **Dai primi passi al portafoglio.** Lezioni, quiz e Mentori ti portano nel mondo degli investimenti e del trading, un concetto alla volta.
- **Solo denaro finto.** La pratica passa da un conto Alpaca Paper, gratuito: prezzi e orari veri, soldi che non esistono. Non ti chiederemo mai di versare nulla.
- **Sbagliare è permesso.** Un errore costa capitale di gioco, non i tuoi risparmi. È solo apprendimento: non è consulenza e non ti dice cosa comprare.

## Guida

L'essenziale per partire. Le regole complete te le spiegano i personaggi, dentro il gioco.

### #01 Attestati e Sigilli

In ogni città un Mentore assegna una Medaglia in due metà. **L'Attestato** si vince a quiz e basta per proseguire. **Il Sigillo** si guadagna con la Prova sul conto: ordini veri, con denaro finto, usando la Tecnica appena imparata.

> Puoi viaggiare con i soli Attestati, ma **nella Lega entra solo chi ha tutti e otto i Sigilli**.

### #02 Il conto di gioco

Serve un conto **Alpaca Paper**: gratuito, basta un'email, prezzi veri e denaro finto. Senza conto puoi comunque studiare e vincere gli Attestati. La **difficoltà** scelta all'inizio fissa il capitale; ogni tappa chiede solo una quota minima da investire, il resto lo decidi tu.

| Livello | Capitale | Quota minima per tappa | Dopo una bancarotta |
|---|---|---|---|
| Apprendista | 10.000 $ | 5% | si riparte con metà capitale |
| Investitore | 5.000 $ | 7% | si riparte con metà capitale |
| Stratega | 2.500 $ | 8,5% | si riparte una volta sola |
| Leggenda (Nuova Partita+) | 1.000 $ | 9,5% | la parte pratica finisce |

### #03 Bancarotta

Scatta quando il conto arriva a **zero**, per colpa della leva o di vendite in perdita. Cosa succede dopo dipende dalla difficoltà.

### #04 La Lega

Quattro Superiori e il Campione ti sfidano a quiz e poi guardano il tuo conto: **si giudica il metodo, non il rendimento**.

### #05 Dopo la Lega

Torre delle Sfide, crisi leggendarie e tre Boss dei Mercati, che si battono con un piano di ordini sul conto di gioco. La **Nuova Partita+** riparte da zero e sblocca la difficoltà Leggenda.

### #06 Il tuo salvataggio

Crei un giocatore con nome e password: la partita si salva online e la ritrovi su ogni dispositivo. La password non si può recuperare, quindi conservala.

### #07 Come collegare Alpaca

1. Crea un account su alpaca.markets: per il conto Paper basta l'email.
2. Nella dashboard, in modalità **Paper**, genera le chiavi API (Key ID e Secret).
3. Nel gioco apri il menu, voce **Chiavi API**, e inseriscile.

Le chiavi restano **solo sul tuo dispositivo**, cifrate con la password del giocatore, e puoi revocarle quando vuoi dalla dashboard di Alpaca.

### #08 Si gioca dal browser

Non c'è niente da scaricare o installare: entri con il tuo giocatore, colleghi il conto Paper e **gli ordini partono dal tuo browser direttamente verso Alpaca**. Li decidi sempre tu, e il gioco li controlla prima di inviarli.

Se la tua rete blocca Alpaca, il gioco ti propone di far passare le richieste dal servizio di Tradermon, che non salva le chiavi. Lo scegli tu.
