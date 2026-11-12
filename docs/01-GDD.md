# Tradermon – Game Design Document (specifica estesa)

Versione 1.0 · 9 novembre 2026 · deriva dal piano "Pokenomics 101 – Piano di implementazione".

Tradermon è un RPG 2D top-down in stile palmare a 16 bit in cui il protagonista è un giovane investitore. Al posto delle lotte ci sono **sfide di conoscenza** (quiz) e **missioni di trading** (simulazione), al posto dei capipalestra ci sono **8 Mentori**, alla fine c'è la **Lega degli Investitori**. Il mondo, i personaggi, la mappa, i nomi, la grafica e la musica sono originali: il gioco riprende solo le meccaniche del genere, che non sono protette.

Regole d'oro del progetto:

1. **Si sblocca solo sapendo.** Nessun oggetto di cattura, nessuna pozione, nessun negozio. Asset, informazioni e tecniche si ottengono solo battendo Mentori e superando sfide.
2. **Solo denaro finto.** Tradermon è pensato per aiutare chi vuole entrare nel mondo degli investimenti e del trading, ed è volto solo all'apprendimento. Tutto il gioco si svolge con denaro finto, sul conto Alpaca Paper: non vengono mai usati soldi reali.
3. **Premi solo dallo studio e dal conto di gioco.** XP, Medaglie, classifiche e carte si ottengono in simulazione o sul conto Paper.
4. **Educazione, non consulenza.** Il gioco non dice mai "compra X": il giocatore sceglie da solo.
5. **Le chiavi non stanno nel codice.** Le chiavi Alpaca si inseriscono nel gioco e vengono custodite dal server locale, mai nel browser né nel repository.

---


> **Aggiornamento: gioco sui dati reali (sostituisce le parti sul "mercato simulato" e sul "Conto di Prova" qui sotto).**
> - Titoli, prezzi e grafici sono solo quelli reali di Alpaca; i titoli di fantasia e l'indice "Capitalia 100" non esistono più. Senza conto Alpaca Paper collegato resta il percorso di studio.
> - Difficoltà scelta all'inizio (Apprendista 10.000 $, Investitore 5.000 $, Stratega 2.500 $, Leggenda 1.000 $): fissa capitale, costo didattico per ordine, quota minima di tappa e regola della bancarotta. Non si cambia. Leggenda si sblocca solo con la Nuova Partita+.
> - Conto di gioco: registro dentro il conto Alpaca Paper, aggiornato solo dagli ordini inviati dal gioco e riconciliato con le posizioni vere. Tutto il capitale è investibile dal primo giorno; ogni tappa chiede una quota minima cumulata (5% / 7% / 8,5% / 9,5% del capitale per tappa), mai un massimo. Ordini anche frazionati.
> - Medaglia = Attestato (duello, apre la strada) più Sigillo pratico (Prova sul conto: quota della tappa investita con ordini veri sul mercato di oggi, usando la Tecnica appena imparata). La Lega chiede otto Sigilli. I replay vivono solo nella Macchina del Tempo (Zona Simulazione: missioni facoltative, periodi liberi, crisi storiche) e nelle crisi leggendarie della Torre; i Mentori non ne propongono.
> - Lega: duello più verifica del conto com'è adesso. Marta Macro: almeno metà del patrimonio investito, tre titoli, uno difensivo. Tito Tecnico: nessun titolo oltre il 40% dell'investito e stop attivi su almeno un quarto. Giulia Garante: lo sportello delle offerte (non passa dal conto). Fabio Freddo: quota rischiosa entro 15 punti dal proprio piano e tre decisioni motivate nel Diario. Campione: tutto insieme, senza chiamate di margine. Nessuna prova chiede un rendimento; contano solo gli ordini eseguiti (`src/systems/trials.ts`).
> - Bancarotta: quando il conto arriva a zero (sotto 1 $), in ogni difficoltà. Le quote di tappa sono importi fissi sul capitale di partenza della difficoltà, anche dopo perdite o una ripartenza (`stageQuota`, `ZERO`). Ripartenza con metà del capitale di partenza; una sola in Stratega; nessuna in Leggenda.
> - Leva: esame dal 5º Attestato (vale nei replay), sul conto dall'8º, massimo 2×, interessi 6,5%, mantenimento 30%, chiamata di margine di tre giorni di mercato. Dividendi: solo teoria.
> - Dopo la Lega: aumenti di capitale, crisi leggendarie su periodi reali, tre Boss dei Mercati (quiz più un solo piano valutato sulle candele reali dopo 2 ore, 3 giorni o 4 settimane; il piano invia ordini veri sul conto di gioco, un acquisto dimensionato sul rischio e uno stop, e in caso di sconfitta la perdita resta sul conto). Nuova Partita+: tutto da zero tranne i trofei, con la difficoltà Leggenda sbloccata.
> - Bancarotta, come ci si arriva: con la leva oppure con le perdite realizzate. Le vendite in perdita contano sia fatte nel gioco sia fatte fuori (sito di Alpaca): il gioco le riconosce alla sincronizzazione, le registra al prezzo vero di esecuzione e ricontrolla la bancarotta. Nelle Prove sul conto si può vendere un titolo e puntare su un altro, ma decidere di vendere un titolo comprato per la Prova in corso, anche solo una parte, annulla la Prova (decisione dell'utente dell'11 novembre, 15:37Z): il gioco lo chiede in modo esplicito prima della vendita, la quota della tappa riparte da zero e il titolo venduto non conta finché la Prova non è completata con un altro. Vale anche per uno stop che scatta, per le vendite fatte fuori dal gioco, per la vendita forzata della leva e per la bancarotta (decisione delle 15:55Z; in questi ultimi due casi nessun titolo viene escluso); non per le verifiche della Lega, che guardano il conto com'è. Opzione "Prosegui anche se la Prova va male" (decisione delle 15:56Z): solo in Apprendista e Investitore, dalle Impostazioni o da Menu, Opzioni; non salta la Prova, ignora soltanto l'esito negativo e lascia proseguire, con l'avviso che è una scelta sconsigliata per chi vuole imparare. Nei mandati dei Boss la decisione di vendere prima della scadenza annulla la sfida, che si ripete da capo con un titolo diverso e non conta come sconfitta.
> - Dove si opera: sul sito pubblico è il browser a inviare gli ordini direttamente al conto Alpaca Paper (giocatore collegato, chiavi solo sul dispositivo, cifrate con la sua password, con avviso prima dell'inserimento). Se il browser non raggiunge Alpaca, il giocatore può scegliere di far passare il conto Paper dalla funzione Supabase `alpaca`. Giocando sul proprio computer le chiavi restano nel server locale.
> - Tradermon usa solo il conto Paper, con denaro finto: non esiste un conto con soldi reali. Numeri in `src/systems/balance.ts`; regole in `src/systems/account.ts`, `realdata.ts`, `boss.ts`.

## 1. Esperienza del giocatore in sintesi

| Fase | Durata indicativa | Cosa impara | Cosa sblocca |
|---|---|---|---|
| Prologo e onboarding | 8-12 min | Paper trading, profilo di rischio, primo acquisto | Percorso, Valigetta iniziale, tessera da Apprendista |
| Regione (8 città) | 4-8 h | 8 moduli, uno per Mentore | 8 Medaglie, tecniche, slot di portafoglio, Asset Card |
| Lega | 1-2 h | Macro, analisi, regole, psicologia | Titolo di Campione, Nuova Partita+ |
| Post-game | illimitato | Crisi storiche, Torre delle Sfide | Carte dorate, record |

Il ciclo base, ripetuto in ogni città: **impara** (Biblioteca, allievi, cartelli) → **verifica** (allievi dell'Accademia, investitori sul percorso) → **applica** (Macchina del Tempo, missioni di analisi) → **sfida il Mentore** (quiz + missione).

---

## 2. Onboarding: le informazioni chieste all'inizio

L'onboarding segue la struttura classica del genere (risveglio in camera, professore, scelta del compagno iniziale, rivale) ma ogni passo raccoglie un dato che serve al gioco. Tutti i dati restano nel salvataggio locale e si possono rivedere nel menu Profilo.

### 2.1 Sequenza

| # | Scena | Dato raccolto | Uso nel gioco |
|---|---|---|---|
| 1 | Schermata titolo | Nuova partita / Continua / Importa salvataggio | — |
| 2 | Avviso iniziale (schermata seria) | Presa visione: "gioco educativo, non consulenza finanziaria" | Obbligatorio per proseguire |
| 3 | Il Prof. Bruno Saldi si presenta | Nome del giocatore (scelto alla creazione dell'account, 3-15 caratteri) | Dialoghi, salvataggio |
| 4 | "Qual è il tuo colore preferito?" (8 colori, anteprima dal vivo dietro il banco del Prof) | Vestiti e cappellino del protagonista di quel colore, ovunque: mappa e sfide (nessuna implicazione di gameplay; i vecchi salvataggi 0-2 restano rosso, blu, verde) | Sprite del protagonista |
| 5 | Questionario del Professore (5 domande) | Profilo di rischio: Prudente / Equilibrato / Audace | Tono dei consigli, durata timer, difficoltà missioni |
| 6 | "Quale obiettivo hai?" | Obiettivo: Imparare le basi / Costruire un piano di lungo periodo / Capire il trading | Testi del diario e messaggi motivazionali |
| 7 | "Qual è il tuo orizzonte?" | Orizzonte: < 3 anni / 3-10 anni / > 10 anni | Spiegazioni personalizzate su rischio e orizzonte |
| 8 | Presentazione del rivale: Leo, un bambino rimasto senza famiglia che il Prof ha adottato e cresciuto (il nome è fisso; i vecchi salvataggi tengono quello scelto) | — | Dialoghi del rivale |
| 9 | Risveglio in camera, si scende, si va al Laboratorio | — | Tutorial di movimento |
| 10 | **La scelta delle Valigette** | Percorso: Titoli / ETF / Cripto (oppure Misto parlando col Professore) | Tutta la storia |
| 11 | Configurazione del Conto di Prova | Capitale virtuale, valuta mostrata, allocazione obiettivo | Simulatore e Clinica |
| 12 | Si usano soldi veri? | Il Professore spiega che il gioco usa solo denaro finto, sul conto Paper | Tessera da Apprendista nel menu |
| 13 | Primo duello col rivale (3 domande facili) | — | Tutorial del quiz |
| 14 | Primo acquisto guidato alla Clinica di Borgo Semina | La Valigetta diventa una posizione in portafoglio | Tutorial della Clinica |

Obiettivo di design dal piano: entro 3 minuti di gioco effettivo il giocatore ha già fatto la scelta e vinto un mini-quiz; entro 10 minuti ha fatto il primo acquisto simulato.

### 2.2 Questionario del profilo e Specchio dell'investitore

Tre domande ispirate ai questionari di adeguatezza (MiFID II), semplificate e senza valore legale. Ogni risposta vale 0, 1 o 2 punti.

| Domanda | 0 punti | 1 punto | 2 punti |
|---|---|---|---|
| Il tuo portafoglio perde il 20% in un mese. Cosa fai? | Vendo tutto | Aspetto e ripasso il piano | Compro ancora |
| Per quanto non ti servono questi soldi? | < 3 anni | 3-10 anni | > 10 anni |
| Una perdita del 30% per te sarebbe… | Inaccettabile | Dura ma gestibile | Parte del gioco |

Totale 0-1 → **Prudente**, 2-3 → **Equilibrato**, 4-6 → **Audace**. È il profilo **dichiarato**.

Scopo: insegnare il divario tra la tolleranza al rischio che dichiariamo a mente fredda e quella che mostriamo quando le perdite sono vere (avversione alle perdite). Il profilo **non è una leva di gioco**: timer dei duelli e soglie delle missioni sono uguali per tutti, quindi mentire non porta vantaggi e rovina solo lo Specchio.

**Specchio dell'investitore** (`systems/mirror.ts`). A fine di ogni missione della Macchina del Tempo (Mentori, Lega, Leggende) con almeno un ordine il gioco registra, senza dirlo, quota investita, peso massimo, vendite in perdita, massimo drawdown e ordini (l'ultima prova per missione, in `flags.mirror`). Ogni missione vale 0-2 sulla stessa scala del questionario: investito ≥ 75% → 1 (≥ 40% → 0,5), una posizione oltre il 40% → +0,5, drawdown oltre il 12% → +0,5, due o più vendite in perdita → −0,5. La media dà il profilo **rivelato** (< 0,7 Prudente, < 1,3 Equilibrato, altrimenti Audace), disponibile dopo 2 missioni.

Dove si vede: alla Clinica la voce "Specchio dell'investitore" confronta dichiarato e rivelato con i fatti osservati e una breve lezione, poi permette di rifare il questionario (se il profilo cambia, propone di aggiornare l'allocazione obiettivo); la scheda Profilo mostra entrambi; l'epilogo dopo la Lega aggiunge una frase dello Specchio. Il profilo dichiarato propone anche l'allocazione obiettivo del Conto di Prova (Prudente 40/50/10, Equilibrato 60/30/10, Audace 80/10/10, sempre modificabile) e fa scegliere al rivale lo stile opposto. Il Professore spiega che il profilo **non è una raccomandazione**.

### 2.3 La scelta delle Valigette

Nel Laboratorio ci sono tre Valigette sul tavolo, ognuna con un colore e un'etichetta:

| Valigetta | Colore | Percorso | Asset Card iniziale (simulata) | Antagonisti | Lettera del Professore |
|---|---|---|---|---|---|
| Valigetta Blu | blu | Sentiero dei Titoli (solo azioni) | **Solaria Energia (SLR)**, settore Energia rinnovabile | Gli Speculatori (soffiate, FOMO) | "Possiedi un pezzo di un'azienda vera: impara a conoscerla." |
| Valigetta Verde | verde | Sentiero degli Indici (solo ETF) | **Globo Mondo ETF (GLB)**, azionario globale | Il Venditore di Commissioni | "Mille aziende in una sola mossa: la pazienza è il tuo superpotere." |
| Valigetta Arancione | arancione | Sentiero Cripto (solo cripto) | **Granito (GRN)**, cripto di riserva | Il Re dei Rug Pull | "Tecnologia nuova, rischio alto: prima la custodia, poi il resto." |

Avvicinandosi a ogni Valigetta compare la scheda: cosa si investe, livello di rischio (1-5 stelle), volatilità storica indicativa della classe, esempio di caduta massima storica della classe, tono della storia. Si conferma con un secondo "Sì".

**Percorso Misto.** Parlando col Professore invece che con una Valigetta, lui propone il "Sentiero Misto": il giocatore sceglie 2 o 3 classi. Riceve la Valigetta della prima classe scelta e la Asset Card iniziale delle altre si sblocca col 1° Mentore. I Mentori 5 e 6 parlano di asset allocation, l'antagonista è "l'Alleanza degli Speculatori".

Dopo la scelta il rivale prende la Valigetta "opposta" al profilo del giocatore (se il giocatore è Prudente il rivale è Audace) e lancia il primo duello.

### 2.4 Configurazione del Conto di Prova

Schermata guidata dalla Dott.ssa Ratio (arriva al Laboratorio per l'occasione):

| Campo | Opzioni | Default | Note |
|---|---|---|---|
| Capitale virtuale | 1.000 / 10.000 / 50.000 Crediti | 10.000 | 1 Credito = 1 dollaro virtuale. Il capitale non dà vantaggi nei punteggi: tutto è misurato in percentuale |
| Allocazione obiettivo | Preset per profilo, modificabile | vedi sotto | Usata dalla diagnosi e dal ribilanciamento |
| Reinvestimento dividendi | Sì / No | Sì | Mostra la meccanica "Uova" |

Preset di allocazione (azioni o asset rischiosi / difensivi / liquidità): Prudente 40/50/10, Equilibrato 60/30/10, Audace 80/10/10. Per il percorso Cripto "difensivo" significa stablecoin simulata e la liquidità resta in Crediti.

**Nessun denaro aggiunto o tolto dal gioco.** Il conto di prova cambia solo con le operazioni del giocatore e con il mercato simulato (prezzi e dividendi). Non ci sono ricariche, penalità in Crediti o versamenti automatici.

### 2.5 Solo denaro finto

Il Professore consegna la **tessera da Apprendista** e, a chi lo chiede ("Si usano soldi veri?"), spiega che Tradermon è un gioco per imparare: si usa solo il conto Alpaca Paper, con denaro finto e prezzi veri, e non vengono mai usati soldi reali.

---

## 3. Mondo: la Regione di Capitalia

### 3.1 Mappa

Uno scheletro unico, lineare con deviazioni, condiviso da tutti i percorsi. Ogni percorso cambia il sottotitolo delle città, la palette e i dialoghi.

```
Borgo Semina ─ P1 ─ Ponte Cedola ─ P2 ─ Porto Ordini ─ P3 ─ Diversia ─ P4 ─ Interessa
                                                                               │
Altopiano della Lega ─ P9 ─ Rocca Rischio ─ P8 ─ Mentelucida ─ P7 ─ Valdividendo ─ P6 ─ Bilancia ─ P5
```

| Città | Edifici | Mentore e Medaglia | Particolarità |
|---|---|---|---|
| Borgo Semina | Casa, Laboratorio, Clinica | — | Scelta delle Valigette |
| Ponte Cedola | Clinica, Biblioteca, Accademia | 1. Gaia Primo – Medaglia Seme | Prima Prova sul conto |
| Porto Ordini | Clinica, Biblioteca, Accademia | 2. Orazio Limite – Medaglia Ordine | Abbonamento al treno |
| Diversia | Clinica, Biblioteca, Accademia, **Zona Simulazione** | 3. Vera Varia – Medaglia Mosaico | Sandbox Macchina del Tempo · abilità Flusso di Liquidità |
| Interessa | Clinica, Biblioteca, Accademia, **Casinò dello Speculatore** | 4. Cosimo Composto – Medaglia Spirale | Mini-gioco sull'azzardo · abilità Trasferimento di Capitale |
| Bilancia | Clinica, Biblioteca, Accademia, **Archivio** (chiuso) | 5. Mentore specifico A – Medaglia Lente | L'Archivio si apre con "Lettura del Bilancio" |
| Valdividendo | Clinica, Biblioteca, Accademia | 6. Mentore specifico B – Medaglia Raccolto | — |
| Mentelucida | Clinica, Biblioteca, Accademia | 7. Serena Bias – Medaglia Specchio | Muro del Rumore sul percorso 7 |
| Rocca Rischio | Clinica, Biblioteca, Accademia | 8. Rocco Rischio – Medaglia Scudo | Ultimo scontro con gli antagonisti |
| Altopiano della Lega | Clinica, Lega, **Torre delle Sfide** (post-game) | 4 Superiori + Campione | Crisi leggendarie dopo la Lega |

Ogni Percorso (P1-P9) ha: 2-4 investitori sfidanti con linea di vista, erba alta solo decorativa (nessun incontro casuale), cartelli didattici, e all'uscita di ogni città una **Guardia della Borsa** che lascia passare solo con la Medaglia della città.

### 3.2 Edifici ricorrenti

- **Clinica del Portafoglio**: bancone della Dott.ssa Ratio, salvataggio, lezione sui bias, tutte le operazioni di portafoglio (sezione 7).
- **Biblioteca** (ogni città dalla seconda): quattro sezioni su scaffali interattivi. In alto a sinistra la **Sezione del Mentore** (sotto un manifesto): una guida alla sfida generata dal Mentore locale più due libri per ogni argomento del suo duello, uno di contesto (perché quella città ci tiene) e uno di materia (ciò che chiede); le lezioni sugli stessi temi sono raggiungibili dalla stessa sezione. Leggere un libro dà 5 XP (contatore delle lezioni), completare la sezione +10 Reputazione. A destra la sezione generale (tutte le lezioni sbloccate), in basso l'archivio delle domande sbagliate (ripasso) e l'Investidex. La Bibliotecaria spiega le sezioni alla prima visita e il Mentore, prima del duello, ricorda la sua sezione se restano libri non letti. Il Prof. Saldi e una studentessa a Borgo Semina presentano il meccanismo nel prologo. "Domanda del giorno" (streak) con la Professoressa del giorno. Testi in `src/data/books.ts`.
- **Insegne**: gli edifici pubblici hanno un'insegna sul muro sopra la porta (CLINICA, PALESTRA per l'Accademia, BIBLIOTECA, LABORATORIO, SIMULAZIONE, CASINÒ, ARCHIVIO, LEGA, TORRE). Le case non ne hanno.
- **Accademia**: 2 allievi (duelli da 4 domande) e il Mentore. Gli allievi non si saltano: se provi a superarne uno senza averlo battuto (anche alle sue spalle), si gira, compare il fumetto con il "$", ti raggiunge e ti sfida a quiz; se perdi rinasci nella Clinica dello stesso villaggio (Fiducia ricaricata). Il duello col Mentore (e quelli della Lega) ha sempre lo stesso numero di domande, anche nei tentativi successivi a una sconfitta: si risponde a tutte, anche a Fiducia esaurita, e si vince con il numero minimo di risposte giuste. Il Mentore accetta la sfida solo dopo che hai battuto tutti i suoi allievi.
- **Case abitate**: ogni città ha 3-4 case visitabili (Borgo Semina una), 30 in tutto. Ogni casa ospita un nucleo: una persona sola, una coppia o una famiglia di tre persone. Gli interni sono arredati in modo diverso secondo il nucleo. Ogni abitante insegna un concetto diverso, per un totale di 62 argomenti, mai ripetuti tra un abitante e l'altro. Ogni consiglio ha una fonte (registrata nei dati, non mostrata in gioco). I temi seguono la città: basi a Borgo Semina e Ponte Cedola, ordini a Porto Ordini, diversificazione a Diversia, costi e interesse composto a Interessa, analisi a Bilancia, dividendi, obbligazioni e tassi a Valdividendo, bias a Mentelucida, gestione del rischio a Rocca Rischio. Si aggiungono temi di macroeconomia, fiscalità italiana e sicurezza. La prima volta che parli con un abitante ottieni +5 XP e il consiglio viene annotato nell'Investidex, dove puoi rileggerlo. Le fonti non compaiono durante il gioco: sono tutte elencate in Opzioni → Crediti e fonti.

### 3.3 Mercato, orologio e clima

- **Orologio di mercato.** L'ora reale del dispositivo convertita in ora di New York: Borsa aperta 9:30-16:00 lun-ven (finestre fuori orario mostrate come "pre/after market"), cripto sempre aperte. Di notte la mappa si scurisce e alcuni NPC cambiano battuta. Nel simulatore interno il tempo di mercato avanza di 1 giorno ogni 60 passi sui percorsi e di 1 giorno a ogni sfida.
- **Clima di mercato** (il "meteo"): calcolato sull'indice simulato "Capitalia 100" con media mobile a 50 giorni e volatilità a 20 giorni. Toro (sopra la media, vol bassa), Orso (sotto la media), Tempesta (volatilità > 1,5 volte la media), Laterale. Il clima cambia tinta e particelle della mappa, la frequenza degli eventi e quali eventi escono.

---

## 4. Personaggi

| Ruolo | Nome | Descrizione |
|---|---|---|
| Professore | Prof. Bruno Saldi | Ex gestore di fondi, ironico, insegna che "la prima regola è non perdere la testa" |
| Infermiera della Clinica | Dott.ssa Ratio | Sempre uguale in ogni città (come da tradizione del genere, è "una delle sorelle Ratio") |
| Rivale | Leo (nome scelto) | Stile opposto al profilo del giocatore; 4 incontri: Laboratorio, Percorso 2, Diversia, Via della Lega |
| Antagonisti | Gli Speculatori (capo: Max Leva) | Variante per percorso: Speculatori (Titoli), Venditori di Commissioni guidati da Carlo Provvigione (ETF), Banda del Rug Pull guidata dal Re Tappeto (Cripto), Alleanza (Misto) |
| Mentore 1 | Gaia Primo | Fondamenta: cos'è l'asset del percorso, rischio e rendimento |
| Mentore 2 | Orazio Limite | Ordini, spread, orari di mercato |
| Mentore 3 | Vera Varia | Diversificazione e correlazione |
| Mentore 4 | Cosimo Composto | Costi, interesse composto, piano di accumulo |
| Mentore 5 | Bianca Bilanci / Ivo Indice / Nina Nodo / Alba Allocazione | Specifico A: bilanci (Titoli), replica e TER (ETF), blockchain e custodia (Cripto), asset allocation (Misto) |
| Mentore 6 | Dario Dividendi / Olga Obbligazioni / Stella Stabile / Alba Allocazione bis → Teo Tassi | Specifico B: dividendi e valutazione, obbligazioni e tassi, stablecoin, DeFi e truffe |
| Mentore 7 | Serena Bias | Finanza comportamentale |
| Mentore 8 | Rocco Rischio | Gestione del rischio |
| Superiori | Marta Macro, Tito Tecnico, Giulia Garante, Fabio Freddo | Macro; analisi tecnica e fondamentale; regole, truffe e tasse; psicologia e piano |
| Campione | Aurelio Capitale | Prova finale trasversale |

---

## 5. Sistemi di gioco

### 5.1 Statistiche del giocatore

| Statistica | Come sale | Come scende | Effetto |
|---|---|---|---|
| **Conoscenza** (XP e livello) | Risposte giuste (5/10/15/20 XP per difficoltà 1/2/3/4), lezioni lette (+5), sfide vinte | — | Livello = soglia 50·n^1,5 XP. Ogni 5 livelli +5 s al timer e una spiegazione extra |
| **Fiducia** (i "PV") | Clinica, vittorie | Risposte sbagliate (−10/−20 nei duelli col Mentore), eventi sbagliati | A 0 si "va in tilt" e si perde il 5% della Reputazione. Dopo ogni sconfitta in un duello (tilt o risposte giuste insufficienti) si rinasce nella Clinica della città in cui ci si trova (sui Percorsi nell'ultima Clinica visitata) con la Fiducia al massimo |
| **Disciplina** (0-100) | Rifiutare truffe, rispettare limiti nelle missioni, curarsi alla Clinica | Cedere agli Speculatori, superare il drawdown limite | Moltiplicatore del punteggio missioni (0,8-1,2) |
| **Diversificazione** (0-100) | Calcolata dal portafoglio simulato: 100 − indice di concentrazione | — | Statistica visibile e input della salute |
| **Pazienza** (0-100) | Tenere posizioni nei cali senza vendere, pochi ordini nelle missioni | Troppi ordini (overtrading), vendite nel panico | Bonus nelle missioni lunghe |
| **Reputazione** | Vittorie contro investitori (+20), Mentori (+200), missioni | Tilt | Il "denaro" del genere: solo punteggio e classifica, non compra nulla |

### 5.2 Duelli (le lotte)

Schermata a due lati, avversario in alto a destra, giocatore in basso a sinistra, ognuno con la sua barra.

- Barra del giocatore: **Fiducia** (0-100).
- Barra dell'avversario: **Convinzione** (100). Ogni risposta giusta la riduce di 100 / numero di risposte giuste necessarie.
- Domande a scelta multipla con 4 opzioni, a tempo (timer uguale per tutti, 25 s). Dopo ogni risposta compare la spiegazione (la fonte è nei dati e in Opzioni → Crediti e fonti, non a schermo).
- Si vince portando a 0 la Convinzione prima di finire le domande o prima che la Fiducia arrivi a 0.

| Avversario | Domande | Giuste necessarie | Danno per errore |
|---|---|---|---|
| Investitore sul percorso | 3 | 2 | 10 |
| Allievo dell'Accademia | 4 | 3 | 10 |
| Rivale | 5 | 3-4 | 15 |
| Mentore (fase 1) | 8 | 6 | 15 |
| Superiore (fase 1) | 10 | 8 | 15 |
| Campione (fase 1) | 12 | 10 | 15 |

**Sfida del Mentore.** Fase 1 duello di quiz; fase 2 **missione pratica** nella Macchina del Tempo (sezione 6). Se si perde la fase 2 si ripete solo la fase 2. Vincere dà: Medaglia, Tecnica, Asset Card del Mentore, slot di portafoglio, sblocchi della Clinica, +200 Reputazione.

**Investitori sul percorso.** Linea di vista di 4 tessere: quando il giocatore entra nella linea, il personaggio mostra il fumetto con il "$", si avvicina e sfida. Una volta battuto non sfida più (ma si può riparlarci per un consiglio).

### 5.3 Asset Card e Investidex

Ogni asset del mercato simulato è una Asset Card con: nome, ticker, classe (azione, ETF, cripto), **tipo/settore**, rischio (1-5), descrizione, livello (1-4), flag dorata.

Livelli ("evoluzione"): la carta guadagna XP quando si risponde a domande o si completano missioni in cui compare, oppure tenendola in portafoglio durante un mese simulato.

| Livello | XP carta | Informazioni mostrate |
|---|---|---|
| 1 Base | 0 | Prezzo, settore, descrizione |
| 2 Fondamentali | 30 | Rendimento atteso didattico, dividendi o TER, capitalizzazione |
| 3 Indicatori | 80 | Volatilità, beta, max drawdown storico simulato |
| 4 Storia | 150 | Grafico storico completo e "curiosità" della carta |

**Carta dorata ("shiny").** Si ottiene superando tutte le sfide in cui compare la carta senza errori: solo cosmetica.

**Investidex** ha tre sezioni: Asset, Concetti (sbloccati leggendo lezioni), Bias (sbloccati incontrandoli). Mostra percentuale di completamento.

### 5.4 Tipi e debolezze: settori ed eventi

Ogni asset ha un tipo. Gli eventi di mercato hanno una matrice di effetti per tipo (moltiplicatore sul rendimento del giorno dell'evento). Estratto:

| Evento | Tech | Finanza | Energia | Salute | Consumi | Utility | Obblig. | Oro | Cripto |
|---|---|---|---|---|---|---|---|---|---|
| Banca centrale alza i tassi | −4% | +2% | 0 | −1% | −2% | −3% | −3% | −1% | −6% |
| Banca centrale taglia i tassi | +4% | −1% | +1% | +1% | +2% | +2% | +2% | +1% | +6% |
| Petrolio alle stelle | −2% | 0 | +6% | 0 | −3% | −1% | −1% | +2% | −2% |
| Recessione annunciata | −5% | −6% | −4% | −1% | −4% | +1% | +3% | +4% | −8% |
| Boom dell'intelligenza artificiale | +7% | +1% | +1% | +1% | 0 | 0 | 0 | 0 | +3% |
| Hack di un exchange | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +1% | −12% |
| Pandemia | −3% | −5% | −8% | +5% | −4% | 0 | +3% | +3% | −5% |
| Inflazione sopra le attese | −3% | +1% | +3% | −1% | −2% | −1% | −4% | +3% | −3% |

La lezione: un portafoglio con tipi diversi soffre meno di uno con un solo tipo.

### 5.5 Slot di portafoglio (la "squadra")

Numero massimo di posizioni diverse nel portafoglio simulato: 3 all'inizio, poi 4 / 5 / 6 / 6 / 8 / 8 / 10 / 10 dopo le Medaglie 1-8. Le carte sbloccate ma non possedute stanno nella **Watchlist** (il "box"), consultabile dalla Clinica e dal menu.

### 5.6 Tecniche (al posto degli strumenti)

| Tecnica | Mentore | Effetto in gioco | Effetto sulla mappa |
|---|---|---|---|
| Lettura del Ticker | 1 | Investidex mostra il livello 2 delle carte | — |
| Ordine Limite | 2 | Ordini limite nella Clinica e nella Macchina del Tempo | — |
| Ribilanciamento | 3 | La Clinica calcola lo scostamento dall'allocazione obiettivo; gli ordini li sceglie il giocatore | — |
| Piano di Accumulo | 4 | Acquisti ricorrenti automatici nel simulatore | — |
| Lettura del Bilancio (Titoli) / Analisi del Prospetto (ETF) / Custodia Sicura (Cripto) / Visione d'Insieme (Misto) | 5 | Livello 3 delle carte, domande con dati | Apre l'Archivio di Bilancia |
| Reinvestimento | 6 | Uova dei dividendi più rapide | — |
| Mente Fredda | 7 | 50% di probabilità di resistere ai bias | Attraversa il Muro del Rumore sul P7 |
| Stop Loss | 8 | Ordini stop nella Clinica e nella Macchina del Tempo | — |

Prima di "Ordine Limite" esistono solo ordini a mercato; prima di "Stop Loss" non esistono ordini stop.

### 5.7 Bias (solo lezioni, nessuno stato alterato)

I bias si imparano, non si "subiscono". Non esistono stati alterati che cambiano il duello, il patrimonio o le regole: il gioco non modifica mai il conto al posto del giocatore.

| Bias | Dove si incontra | Cosa insegna |
|---|---|---|
| **FOMO** | Proposte degli Speculatori, Lezione sui bias in Clinica | La paura di restare fuori spinge a comprare tardi e caro |
| **Panico** | Lezione sui bias in Clinica | Vendere durante un crollo trasforma una perdita temporanea in definitiva |
| **Eccesso di fiducia** | Lezione sui bias in Clinica | Qualche successo non è una prova di abilità |
| **Effetto gregge** | Proposte degli Speculatori, Lezione sui bias in Clinica | Seguire la folla non è un'analisi |

Un bias riconosciuto (rispondendo bene alla domanda in Clinica, o rifiutando/accettando una proposta) viene annotato nella sezione Bias dell'Investidex.

### 5.8 Erba alta

L'erba alta dei percorsi è solo decorativa: camminarci non fa partire incontri, domande o stati. Le sfide sono sempre visibili (investitori con linea di vista, Mentori, Accademie). Nel mondo 2.5D ogni cella di erba alta ha il tile fitto come terreno e cinque ciuffi sfalsati che si sovrappongono alle celle vicine; i prati hanno un ciuffo ogni due o tre celle.

### 5.9 Rivale

Il portafoglio del rivale è simulato con regole fisse (Audace: 2 asset ad alto rischio, cambia spesso; Prudente: molto liquido). A ogni incontro c'è prima un duello di quiz e poi il **confronto dei portafogli**: rendimento, volatilità, massimo drawdown e indice di Sharpe del giocatore contro quelli del rivale. Il dialogo commenta la differenza tra rendimento puro e rendimento corretto per il rischio.

### 5.10 Viaggio: treno e viaggio rapido

Dopo la Medaglia 2 l'**abbonamento al treno**: dalle stazioni nelle città si va alla città successiva già visitata. Dopo la Medaglia 6 il **viaggio rapido** dal menu verso qualsiasi città visitata.

### 5.11 Zona Simulazione (sandbox)

Edificio di Diversia: Macchina del Tempo libera, senza punteggio, con tutti gli scenari sbloccati fino a quel momento. Se è collegato Alpaca, si possono riprodurre le barre storiche reali di un simbolo scelto dal giocatore.

### 5.12 Casinò dello Speculatore

Edificio di Interessa. Una roulette con 37 caselle e fiches finte. Le probabilità e il margine del banco (2,7%) sono scritti sul tavolo. Il "Sistema Martingala" proposto dallo Speculatore porta prima o poi a perdere tutto in una simulazione accelerata di 200 giri. Nessun premio utile: solo una voce dell'Investidex ("Azzardo vs investimento").

### 5.13 Duelli con codice (cavo link)

Dal menu Profilo si genera un **codice sfida** (seed). Un amico che inserisce lo stesso codice gioca lo stesso scenario della Macchina del Tempo e lo stesso quiz; alla fine entrambi vedono un codice risultato da confrontare. Nessun server richiesto.

### 5.14 Post-game: crisi leggendarie e Torre

- **Crisi leggendarie**: 5 scenari ricostruiti (1929, 2000, 2008, 2020, 2022) con obiettivi difficili. Battendole si ottengono le carte "leggendarie" (cosmetiche).
- **Difficoltà progressiva delle domande** (src/systems/quiz.ts, `targetDiff`): quattro livelli (1 base, 2 intermedio, 3 avanzato, 4 esperto). Ogni tappa della storia alza la difficoltà media di un quarto di livello: Mentore 1 = 1, Mentore 8 = 2,75, Superiori della Lega 3,25 → 4, Campione 4. Un duello mescola i due livelli vicini (es. 1,5 = metà livello 1 e metà livello 2). Gli allievi sono un quarto sotto il loro Mentore; gli avversari dei Percorsi seguono la tappa del Percorso (r − 1 medaglie) o quella raggiunta, se più avanti. Il livello 4 compare solo nella Lega, nella Torre e negli incontri facoltativi più duri.
- **Criteri per assegnare la difficoltà** (basati su fonti esterne):
  - *Livello 1, base*: risparmio e investimento, rischio e rendimento, cosa sono azioni, obbligazioni e fondi, prezzi da domanda e offerta, dividendi, idea di diversificazione, i rendimenti passati non garantiscono quelli futuri. Sono i parametri di riferimento per il terzo anno delle medie (grade 8) dei National Standards for Financial Literacy (CEE) e l'area 1 del quadro IOSCO/OECD per gli investitori.
  - *Livello 2, intermedio*: rendimento reale e inflazione, effetto dei costi nel tempo, interesse composto con calcoli, allocazione per età e orizzonte, politica monetaria di base, rapporto inverso tra prezzi e rendimenti delle obbligazioni. Sono contenuti dell'ultimo anno delle superiori (grade 12) e dell'area 2 IOSCO.
  - *Livello 3, avanzato*: duration e sensibilità ai tassi, margine e vendite allo scoperto, bias comportamentali in situazioni concrete, macroeconomia e cambi, indicatori di bilancio. Nelle indagini FINRA/NFCS le domande sui tassi e sui prezzi delle obbligazioni e sull'interesse composto hanno le percentuali di risposte giuste più basse (circa il 30% nel 2009, il 40% nell'HRS 2008); margine, vendita allo scoperto e opzioni compaiono solo nel quiz FINRA per investitori.
  - *Livello 4, esperto*: problemi in più passaggi che combinano gli argomenti avanzati (dimensionamento della posizione con gap, margin call, effetto cambio, PEG, copertura degli interessi, segnali di frode combinati).
  - Anche l'ordine degli argomenti dei Mentori segue questa scala: le basi e il rischio vengono per prime; obbligazioni, bias, leva e margine verso la fine; macroeconomia e regole nella Lega.
  - Fonti: IOSCO/OECD, *Core Competencies Framework on Financial Literacy for Investors* (2019); Council for Economic Education, *National Standards for Financial Literacy* (benchmark grade 8 e grade 12); FINRA Foundation, *Why Is Measured Financial Literacy Declining?* (NFCS 2009–2021); Lusardi e Mitchell, HRS 2008 (PMC5445927); FINRA, *Investing Knowledge Quiz* (2023).
- **Torre delle Sfide**: piani infiniti, ogni piano 3 domande casuali di difficoltà crescente; record personale salvato.
- **Nuova Partita+**: si ricomincia da zero (conto di gioco, Attestati, Sigilli, Prove sul conto, leva, accesso a Torre e Boss), scegliendo di nuovo percorso e difficoltà. Restano solo i trofei (record della Torre, crisi leggendarie, Boss battuti, carte dorate, traguardi, titolo, arredi, Diario) e sblocca la difficoltà Leggenda.

### 5.15 Uova dei dividendi

Ogni mese simulato gli asset con dividendo pagano (rendimento annuo / 12). Con il reinvestimento attivo i dividendi diventano un "uovo" nella Clinica che si schiude dopo 3 giorni di mercato simulato in nuove quote dello stesso asset, con un'animazione e un contatore dell'effetto composto.

### 5.16 Domanda del giorno e ripetizione

La Biblioteca propone ogni giorno reale una domanda; rispondere ogni giorno aumenta la streak. Le domande sbagliate entrano in una coda di ripasso (algoritmo tipo Leitner a 3 scatole: sbagliata → scatola 1, giusta → scatola successiva); le Zone di Mercato pescano prima dalla scatola 1.

### 5.16b Agenda, traguardi, titoli e rivincite

- **Agenda**: ogni giorno reale tre missioni (lezione, duelli, check-up, consigli, domanda del giorno, passi, Diario, minigioco, ripasso) e ogni settimana ISO una missione più lunga. Le missioni sono estratte con un seme dalla data e dal nome, così sono uguali per tutti i giocatori con lo stesso nome. Ricompensa: solo punti Conoscenza (+25 extra se si completa tutta l'agenda del giorno).
- **Traguardi**: circa 40 obiettivi (duelli, Medaglie, consigli, lezioni, serie, Diario, minigiochi, storie, passi, Torre...). Alcuni danno un **titolo** (scelto dal Profilo, mostrato sulla targhetta dei duelli) e un **oggetto per la casa**.
- **Rivincite**: tre giorni dopo averlo battuto, un investitore del percorso chiede la rivincita con domande di mezzo livello più difficili del primo incontro, pescando dalle sbagliate; vincere dà Reputazione e conta per agenda e traguardi.
- **Dialoghi che ricordano**: gli abitanti contano le visite e commentano Medaglie nuove, titolo e serie della domanda del giorno.
- **Storie a tappe** (`src/world/quests.ts`): sei abitanti, alla seconda visita, chiedono un favore in 2-3 tappe (parlare con un altro abitante, leggere una lezione, fare un check-up, giocare un minigioco, avere N Medaglie, superare una piccola prova). Ricompensa: Conoscenza e un oggetto (radio, acquario, quadro).
- **Casa arredabile**: gli oggetti sbloccati compaiono nella casa di Borgo Semina (bacheca, calendario, cornici sui muri; trofei, scrivania, cabinato, mappamondo, pianta, libreria, radio, acquario a terra).
- **Orari**: di notte (orologio di New York) bambini e ragazzi non sono in giro, le finestre delle case si accendono e compaiono le lucciole.
- **Meteo di mercato**: pioggia con il clima orso, temporale con lampi con la tempesta, scintille con il toro, foglie negli altri casi.

### 5.16c Diario, minigiochi, scenari storici, Osservatorio e sfida della settimana

- **Diario dell'investitore**: dopo ogni operazione (conto di prova, Paper o reale) chiede il motivo da una lista e una nota; la Dott.ssa Ratio commenta (i motivi emotivi, come FOMO o "taglio la perdita perché fa male", vengono segnalati). Dopo 30 giorni di mercato (o 30 giorni reali per Alpaca) la riga torna da rileggere con il prezzo attuale e la domanda "rifaresti la stessa scelta?". Il Diario non tocca mai il conto.
- **Minigiochi** (Biblioteca e Zona Simulazione): Indovina il grafico (volatilità, trend, drawdown), Corsa dell'interesse composto, Carrello diversificato, Bilancio in ordine (P/E, D/E, margine). Punteggio 0-100 e record, nessun effetto sul conto.
- **Scenari storici**: per ognuna delle cinque crisi leggendarie una scheda con quando, cosa successe e la lezione, poi la possibilità di riviverla in sandbox.
- **Osservatorio Alpaca** (Clinica): conto, posizioni, ordini aperti e prezzo di un simbolo in sola lettura, con accanto l'ultimo motivo scritto nel Diario per ogni posizione. Nessun pulsante d'ordine.
- **Sfida della settimana**: otto domande uguali per tutti (seme dalla settimana ISO), un tentativo, punteggio da risposte e tempo. Il risultato è un codice `TS-2026W46-NOME-85-XXX` con controllo, da scambiare con gli amici: chi lo inserisce vede nome e punti nella propria classifica locale. Nessun server né dati del conto nel codice.

### 5.17 Riepilogo delle 17 meccaniche adattate

1. Tipi e debolezze → settori ed eventi. 2. Squadra di 6 → slot di portafoglio. 3. Box → watchlist. 4. Allenatori sul percorso → investitori con linea di vista. 5. Rivale → rivale con stile opposto e confronto dei portafogli. 6. MT/MN → tecniche dei Mentori che aprono la mappa. 7. Stati alterati → bias. 8. Evoluzione → livelli delle Asset Card. 9. Giorno/notte → orologio di mercato. 10. Meteo → clima di mercato. 11. Uova → dividendi reinvestiti. 12. Bici/Volo → treno e viaggio rapido. 13. Zona Safari → Zona Simulazione. 14. Casinò → Casinò dello Speculatore. 15. Cavo link → duelli con codice. 16. Leggendari e Torre Lotta → crisi leggendarie e Torre delle Sfide. 17. Shiny → carte dorate.

Non portati, per scelta: oggetti di cattura, pozioni, negozi, loot box, scambi di asset tra giocatori.

---

### 5.16d Mappa della Regione e abilità di esplorazione

Abilità legate alle Medaglie (non sono oggetti né aiuti nei duelli; codice in `src/world/travel.ts`):

| Abilità | Medaglia | Effetto |
|---|---|---|
| Flusso di Liquidità | 3 (Mosaico) | Il giocatore attraversa l'acqua su una zattera. Sui Percorsi 3, 5 e 7 un lago circonda un'Isola della Liquidità con un abitante che propone un duello difficile una sola volta (5 domande, 4 giuste, nessuna perdita di Fiducia): +120 Conoscenza e studio per tutte le carte. Le tre isole danno il traguardo "Navigatore di Liquidità". |
| Trasferimento di Capitale | 4 (Spirale, il Mentore di mezzo) | Dal menu, voce **Mappa della Regione**, ci si sposta in una città già visitata (si entra in una città la prima volta e diventa disponibile). Regolamento T+1: passa un giorno di mercato. Non funziona dentro la Lega. Animazione del volo: il personaggio si solleva mentre la camera si allontana e passano le nuvole, dissolvenza bianca, poi atterraggio nella città scelta (in 2D e in 2.5D). |
| Taglio dei Costi | 4 (Spirale) | Frantuma i Massi delle Commissioni (restano rotti nel salvataggio). Apre la Galleria del Dark Pool dal Percorso 2. |
| Lanterna della Due Diligence | 5 (Lente) | Si entra nelle grotte buie: Miniera dei Lingotti e Grotta delle Perle. |
| Mente Fredda | 7 (Specchio) | Attraversa il Muro del Rumore sul Percorso 7 (già esistente). |

**Struttura del mondo (non lineare).** Oltre alla strada principale Borgo Semina → Altopiano:
- **Mare della Liquidità**: dal molo di Porto Ordini (Medaglia 3) verso sud. Isola del Faro (Guardiana del Faro, duello unico), Isola del Relitto (la bolla della "Compagnia dei Mari Lontani"), Isola Lontana con la **Grotta delle Perle** (buia, Pescatore di Perle). Traguardo "Capitano di Liquidità".
- **Galleria del Dark Pool**: da metà del Percorso 2 a Diversia, saltando Porto Ordini. Il masso è sul lato del Percorso 2; da Diversia la galleria è un vicolo finché il masso non è rotto.
- **Miniera dei Lingotti**: da metà del Percorso 5 a Valdividendo, saltando Bilancia (buia, quindi solo dalla Medaglia 5).
- `tests/reach.test.ts` simula il mondo per ogni numero di Medaglie: nessuna scorciatoia porta a un'Accademia oltre la successiva, con 8 Medaglie ogni luogo è raggiungibile e da ogni casella si torna a casa.

La Mappa della Regione è sempre consultabile: mostra città visitate e no (???), percorsi, isole, Muro del Rumore, la posizione del giocatore e lo stato delle abilità. Il treno dalle stazioni resta disponibile dalla seconda Medaglia.

## 6. Macchina del Tempo: le missioni di trading

### 6.1 Motore

Il simulatore genera prezzi giornalieri con un modello a fattori: rendimento del giorno = β · fattore di mercato + fattore di settore + rumore idiosincratico, con deriva e volatilità annue per asset, e shock programmati dello scenario (crolli, rimbalzi, eventi di settore). Il generatore è deterministico (seed), quindi le sfide sono ripetibili e confrontabili.

Interfaccia: grafico del prezzo dell'asset selezionato e del valore del portafoglio, lista degli asset disponibili, pannello ordini (a mercato; limite e stop se la tecnica è sbloccata), velocità (pausa, 1×, 4×), pulsante "Acquisto mensile" se Piano di Accumulo è sbloccato, notifiche di notizie. Costi didattici: commissione fissa 1 Credito per ordine + spread dello 0,1% (cripto 0,5%).

Metriche finali: rendimento totale, volatilità annualizzata, **indice di Sharpe** (tasso privo di rischio 0 per semplicità, dichiarato), **massimo drawdown**, numero di ordini, costi totali, peso massimo di una posizione, numero di settori.

### 6.2 Missioni dei Mentori

| Mentore | Scenario | Giorni | Obiettivo |
|---|---|---|---|
| 1 | Mercato normale | 60 | Avere investito almeno il 50% a fine periodo e non scendere sotto il 90% del capitale |
| 2 | Mercato laterale con oscillazioni | 40 | Far eseguire almeno un ordine limite di acquisto |
| 3 | Shock di settore a metà periodo | 80 | A fine periodo almeno 3 settori diversi e nessuna posizione sopra il 40% |
| 4 | 24 mesi di accumulo | 500 | Almeno 10 acquisti mensili e costi totali sotto l'1,5% del versato |
| 5 | Missione di analisi (non a tempo) | — | Titoli: scegliere l'azienda con i fondamentali più solidi tra 3. ETF: scegliere l'ETF più efficiente tra 3 sullo stesso indice. Cripto: riconoscere il progetto truffa tra 3. Misto: costruire un'allocazione entro il 5% dall'obiettivo |
| 6 | Titoli: dividendi; ETF: tassi in salita; Cripto: perdita di aggancio di una stablecoin; Misto: tassi in salita | 120 | Titoli: quote aumentate del 3% grazie al reinvestimento. Altri: drawdown massimo sotto l'8% (Cripto 20%) |
| 7 | Mercato con bolle e notizie euforiche | 90 | Al massimo 6 ordini e valore finale ≥ 95% del capitale |
| 8 | Crollo improvviso | 90 | Drawdown massimo ≤ 12% (≤ 20% per Cripto) |

Le soglie sono uguali per tutti i profili.

### 6.3 Missioni della Lega

> Sostituito dalle verifiche sul conto di gioco descritte nell'aggiornamento in testa al documento: la tabella qui sotto descrive i vecchi replay, che non fanno più parte della Lega (resta solo lo sportello delle offerte di Giulia Garante).

| Avversario | Quiz | Missione | Obiettivo |
|---|---|---|---|
| Marta Macro | Macro, inflazione, tassi | 180 giorni con ciclo di tassi | Sharpe ≥ 0,3 |
| Tito Tecnico | Analisi tecnica e fondamentale | 120 giorni di trend e inversioni | Rendimento > 0 e drawdown ≤ 15% |
| Giulia Garante | Regole, truffe, tasse | Missione di analisi: riconoscere 3 truffe su 5 offerte | 3/3 truffe riconosciute, nessuna offerta onesta scartata per errore |
| Fabio Freddo | Bias e psicologia | 120 giorni con notizie tentatrici | ≤ 8 ordini e Sharpe ≥ 0,2 |
| Aurelio Capitale | Tutto | 250 giorni con un crollo e una ripresa | Sharpe ≥ 0,4, drawdown ≤ 18%, almeno 3 settori |

Il punteggio non premia il rendimento puro ma il rendimento corretto per il rischio, per non premiare chi scommette tutto su un titolo fortunato.

### 6.4 Scenari storici ricostruiti

Ricostruzioni semplificate, con ampiezze vicine a quelle storiche, dichiarate come tali nel gioco:

| Scenario | Caduta massima ricostruita | Riferimento storico |
|---|---|---|
| 1929 | −85% in 3 anni (compressi) | Dow Jones 1929-1932 circa −89% |
| Bolla dot-com | Tech −75%, mercato −45% | Nasdaq 2000-2002 circa −78%, S&P 500 circa −49% |
| Crisi 2008 | Mercato −55%, finanza −75% | S&P 500 ottobre 2007-marzo 2009 circa −57% |
| Covid 2020 | −34% in 23 giorni, poi ripresa | S&P 500 febbraio-marzo 2020 circa −34% |
| Inverno cripto 2022 | Cripto −75%, obbligazioni −15% | Bitcoin novembre 2021-novembre 2022 circa −77% |

---

## 7. La Clinica del Portafoglio

La Dott.ssa Ratio accoglie con: "Benvenuto alla Clinica del Portafoglio! Curiamo le scelte, non i soldi persi." Menu:

| Voce | Paper (simulato) | Alpaca Paper | Sblocco |
|---|---|---|---|
| Check-up | Posizioni, valore, P&L, allocazione per settore e classe, salute | Sì | Subito |
| Compra / Vendi | Ordini guidati con riepilogo costo e rischio | Sì | Subito (limite e stop con le tecniche) |
| Ordini aperti | Vedi e annulla | Sì | Ordine Limite |
| Capitale del conto di gioco | Solo informazioni: il gioco non aggiunge denaro, è tutto denaro finto | Saldo | Subito |
| Salva e riposa | Salva, Fiducia al massimo | — | Subito |
| Diagnosi | Spiegazione in parole semplici e lezione collegata | Sì | Subito |
| Cura (ribilanciamento) | Propone gli ordini, il giocatore conferma ognuno | Sì | Ribilanciamento |
| Lezione sui bias | Una domanda sul bias scelto | — | Subito |
| Uova dei dividendi | Stato dei dividendi in incubazione | — | Subito |
| Cartella clinica | Storico ordini, rendimento nel tempo, export CSV | Sì | Subito |
| Collega Alpaca | Inserimento chiavi Paper | — | Subito |
| Specchio dell'investitore | Confronta profilo dichiarato e rivelato dalle missioni, permette di rifare il questionario e di aggiornare l'allocazione obiettivo | — | Subito |

### 7.1 Salute del portafoglio

Punteggio 0-100:

- parte da 100;
- concentrazione: −1,5 punti per ogni punto percentuale del peso massimo sopra il 25%;
- drawdown dal massimo: −1 punto per ogni punto percentuale;
- liquidità: −10 se sotto il 2%, −10 se sopra il 60% (dopo il primo acquisto);
- scostamento dal piano: −0,5 punti per ogni punto di scostamento totale dall'allocazione obiettivo (somma dei valori assoluti / 2);
- minimo 0.

Stati: **Ottima** ≥ 80, **Buona** 60-79, **Ha la febbre** 40-59, **Affaticata** < 40. Le posizioni con perdita > 20% o peso > 40% sono segnate come "affaticate".

### 7.2 Diagnosi

Regole che producono frasi semplici, sempre generiche (mai "compra X"):

- peso massimo > 40%: "Il {peso}% del portafoglio è in {asset}: se va male, va male quasi tutto." → lezione Diversificazione;
- un solo settore: "Tutte le posizioni sono nello stesso settore: un evento di settore le colpirebbe insieme." → lezione Tipi;
- drawdown > 15%: "Sei {dd}% sotto il massimo: ricordi il tuo piano?" → lezione Gestione del rischio;
- liquidità > 60%: "Gran parte è ferma in liquidità: l'inflazione la erode nel tempo." → lezione Inflazione;
- molti ordini nell'ultimo mese simulato (> 10): "Molti ordini significano più costi e spesso più emozioni." → lezione Costi e bias.

---

## 8. Il conto Paper

Tradermon è un gioco volto solo all'apprendimento: la parte pratica usa esclusivamente il conto **Paper** di Alpaca, con denaro finto e prezzi veri. Non vengono mai usati soldi reali, e il gioco non sposta denaro né chiede di versarne.

### 8.1 Regole di ogni ordine

- Riepilogo prima dell'invio: simbolo, lato, importo, tipo, stima dei costi.
- Solo le classi di asset del percorso (Titoli ed ETF: `us_equity`; Cripto: `crypto`; Misto: le classi scelte), niente vendite allo scoperto, acquisti entro la liquidità (o entro il potere d'acquisto di Alpaca quando il giocatore usa la leva del gioco), ordini in importo (notional) o quantità.
- `client_order_id` unico per idempotenza; sul server locale un registro di ogni ordine.

### 8.2 Chiavi Alpaca

- Il giocatore le crea su alpaca.markets (account Paper gratuito, basta un'email).
- Le inserisce dal menu o dalla Clinica (voce "Chiavi API"). Dal sito restano solo sul dispositivo, cifrate con la password del giocatore; sul proprio computer il browser le invia una sola volta al **server locale** di Tradermon, che le salva in `server/.secrets/keys.json` (escluso da Git, permessi 600) e non le restituisce mai al browser.
- Indirizzi: conto Paper (`paper-api.alpaca.markets`) e dati di mercato (`data.alpaca.markets`). Il gioco, il server locale e la funzione Supabase non accettano altri conti.
- "Scollega" cancella le chiavi dal dispositivo o dal server.

---

## 9. Contenuti didattici

Vedi `docs/02-CONTENUTI-E-FONTI.md`. In sintesi: 9 moduli comuni e 3 moduli per ciascun percorso, ciascuno con lezioni brevi, una banca di domande con spiegazione e fonte, e una missione. Fonti: SEC Investor.gov, Investopedia, CFA Institute, Consob, Banca d'Italia (L'economia per tutti), ESMA.

---

## 10. Interfaccia e controlli

- Risoluzione logica 240×160 (quella delle console portatili dei primi anni 2000), tessere 16×16, personaggi 16×24, ingrandimento a pixel netti.
- Stile grafico: pixel art originale disegnata in codice, ispirata alle portatili di metà anni 2000 (stile DS): rampe di 5 tonalità, contorni colorati invece che neri, ombre portate da alberi e facciate, ombre morbide sotto i personaggi, leggera vignettatura. Gli sprite delle sfide sono ingranditi con Scale2x per bordi più morbidi. Bordi automatici per sentieri, acqua e tetti; acqua, fiori e Muro del Rumore animati; erba alta (Zone di Mercato) con riflessi dorati.
- Finestre nello stile classico: riquadro bianco a doppio bordo, freccia rossa lampeggiante, cursore a triangolo nei menu, tabellone a led del luogo che scorre da sinistra all'ingresso di ogni zona.
- Schermata di sfida (src/ui/arena.ts): un confronto in sala. Giocatore e sfidante stanno affiancati alla stessa altezza, entrambi rivolti verso lo schermo, ciascuno dietro una postazione con un piccolo monitor; sopra di loro una targhetta da terminale con nome, titolo e barra a segmenti (Fiducia, Convinzione). In alto scorre un nastro di concetti del gioco (mai prezzi o titoli reali). Lo sfondo è dipinto in codice e dipende dal luogo: piazza delle quotazioni (sfide comuni), aula dell'Accademia (allievi, Esame della Leva), sala dei monitor (Mentori), tetto della città al tramonto (rivale), fossa degli speculatori (Speculatori e loro capi), sala grande della Borsa di notte (Boss del dopo-Lega), salone della Lega (Lega, Investitrice Leggendaria), Torre delle Sfide, Biblioteca.
- Transizione d'ingresso "campanella d'apertura": una linea di prezzo attraversa lo schermo, dietro di lei crescono le candele fino a coprirlo, poi il grafico si apre in due lungo la linea e compare il luogo della sfida. Con "riduci movimento" dura un attimo.
- Introduzione: il Prof parla dietro il suo banco, davanti alla lavagna dell'aula.
- Tastiera: frecce o WASD per muoversi, Z / Invio / Spazio = conferma, X / Esc = indietro, M = menu.
- Touch: croce direzionale e pulsanti A, B, Menu sullo schermo.
- Menu di pausa: Investidex, Portafoglio, Agenda e traguardi, Diario, Profilo (con scelta del titolo), Medaglie, Tecniche, Mappa della Regione (con Trasferimento di Capitale), Salva, Opzioni (effetti, musica, velocità del testo, scala dei caratteri, contrasto alto, Comandi).
- Resa: la griglia 240×160 è disegnata a risoluzione interna 720×480 (Scale3x per tile e sprite) e adattata allo schermo con filtro lineare; la camera aggiunge vignettatura e una leggera saturazione. Niente sfocatura né scalini.
- Musica: chiptune originale generata in codice, un brano per tipo di luogo, uno per i duelli e uno per la notte; con il clima orso o tempesta i brani maggiori passano in minore e rallentano, con il toro accelerano. Brevi motivi per vittorie, Medaglie e missioni completate. Volume separato dagli effetti nelle Opzioni.
- Accessibilità: testo ingrandibile, nessuna informazione solo a colori, timer disattivabile in modalità "Studio" (in cambio dimezza la Reputazione dei duelli).

## 11. Salvataggio

Al primo avvio, prima del tutorial, si crea un giocatore (nome univoco + password) o si entra con uno esistente. Il salvataggio (automatico all'entrata e uscita dagli edifici e dopo le sfide, manuale dal pulsante e dal menu) va su Supabase, una riga per giocatore; sul dispositivo resta una copia di lavoro per giocare senza rete, inviata appena la connessione torna. Esporta/Importa come file JSON. Il salvataggio contiene: profilo, percorso, posizione, flag della storia, statistiche, Medaglie, tecniche, carte e livelli, portafoglio simulato, stato del mercato simulato, coda di ripasso, record, contatori ed agenda, traguardi e titolo, oggetti della casa, rivincite programmate, storie, Diario, record dei minigiochi, sfide e classifica, memoria dei dialoghi. Non contiene mai le chiavi: le chiavi Alpaca restano solo sul dispositivo del giocatore, cifrate con la sua password, e non vanno su Supabase.

## 12. Fuori dall'ambito della versione 1.0

Classifiche online, OAuth di Alpaca per app di terzi (servirebbe un backend pubblico e un parere legale), app desktop Tauri, musica completa. La struttura dei dati è pronta per aggiungerli.
