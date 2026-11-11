# Tradermon: easter egg della seconda parte

Piano completo e stato di sviluppo dei segreti nascosti. Contiene soluzioni: non è materiale per i giocatori.

## 1. Obiettivo e regole

- Aggiungere segreti nello spirito dei giochi portatili dei primi anni 2000: oggetti invisibili, stanze
  nascoste, personaggi che compaiono solo in certi giorni, rituali e voci di corridoio.
- Tutto originale e a tema conoscenza, trading, azioni e cripto. Nessun nome, luogo o meccanica copiati
  da altri giochi.
- **Si attivano solo dalla seconda metà del viaggio: almeno 4 Medaglie** (`SECRET_BADGE` in
  `src/world/secretsData.ts`). Prima, gli stessi punti sembrano normali.
- Ricompense solo didattiche e simboliche: punti Conoscenza, studio extra per le carte, statistiche,
  titoli, oggetti per la casa. Mai Crediti, mai denaro reale.
- Il test di raggiungibilità del mondo (`tests/reach.test.ts`) resta verde. Un test dedicato
  (`tests/secrets.test.ts`) controlla posizioni, raggiungibilità e indizi.

## 2. I segreti

### 2.1 Le Pagine del Libro Mastro Perduto (oggetti nascosti)

Sei pagine strappate dal diario di Mastro Ventura, un vecchio trader inventato. Non si vedono: si
raccolgono premendo A davanti a una casella che sembra vuota.

| Pagina | Luogo | Casella | Lezione |
|---|---|---|---|
| I | Percorso 5, angolo sud-est | (42,12) | La leva: i prezzi possono restare assurdi più a lungo dei tuoi risparmi |
| II | Percorso 6, riva sud del ruscello | (21,12) | Non inseguire una perdita (revenge trading) |
| III | Percorso 8, fiori a nord-est | (40,1) | Scrivere la tesi prima di comprare |
| IV | Miniera dei Lingotti, fondo della prima galleria | (11,2) | Costi, tasse e rotazione sono ciò che controlli |
| V | Mare della Liquidità, dietro al Faro | (4,6) | Custodia delle chiavi cripto e rischio degli exchange |
| VI | Sala del Nastro (stanza segreta) | (1,5) | Il vantaggio è aspettare più degli altri |

- Ogni pagina dà +60 Conoscenza e termina con una nota a matita che indica, in modo descrittivo, la
  prossima pagina non ancora trovata. L'ordine di raccolta è libero.
- Completate tutte: traguardo segreto **Il Libro Mastro Perduto**, titolo "Custode del Libro Mastro",
  oggetto per la casa "Libro Mastro rilegato".
- Codice: `LEDGER_PAGES`, `findPage()`; il controllo è in `interactFront()` di `scenes/world.ts`.

### 2.2 La Sala del Nastro (stanza nascosta)

- Nella Biblioteca di Bilancia (`library_5`) lo scaffale in alto a destra (9,2) ha un libro messo al
  contrario, "Il Nastro delle Quotazioni".
- Prima della Medaglia 4 il libro si raddrizza e basta. Dopo, si può tirare: lo scaffale scorre e
  diventa un passaggio (flag `secret_tape_open`, passaggio con `lock: 'secret'`).
- Dentro, la stanza `secret_tape` con le vecchie macchine del nastro e la **Vecchia del Nastro**: racconta
  come si "leggeva il nastro" e sfida a un duello di 5 domande (ne servono 4), senza perdere Fiducia,
  una volta sola.
- Vittoria: +150 Conoscenza, +25 studio a tutte le carte, traguardo **Lettore del Nastro**, oggetto
  "Nastro delle quotazioni incorniciato". Nella stanza c'è anche la pagina VI.

### 2.3 La Balena del fine settimana (personaggio a giorni)

- Sull'Isola del Relitto (Mare della Liquidità, casella 36,7) compare **La Balena** solo il sabato e la
  domenica, secondo il calendario del giocatore: quando la Borsa dorme ma le cripto no.
- Lezione: mercato sottile, ordini grandi che spostano il prezzo, slippage, usare ordini limite.
- Ricompensa: +120 Conoscenza, traguardo **Avvistamento**, titolo "Avvistatore di Balene".

### 2.4 Il rituale delle Mani di Diamante

- Sul Percorso 6, a nord-est (40,2), una pietra con due mani scolpite fra due fiori. Il cartello dice
  "CHI NON SI MUOVE, VEDE."
- Bisogna stare sotto la pietra (40,3), rivolti verso di lei, **un minuto intero senza premere nulla**
  (`HODL_MS`). A metà tempo compare un messaggio ("Le mani di pietra sembrano scaldarsi...").
  Qualsiasi tasto, menu o movimento azzera il conteggio.
- Lezione: tenere con una tesi è pazienza, tenere senza una tesi è testardaggine.
- Ricompensa: +150 Conoscenza, +10 Pazienza, traguardo e titolo **Mani di Diamante**.

### 2.5 Il Sussurratore del Casinò (voci di corridoio)

- Al Casinò di Interessa, dalla Medaglia 4, compare **Il Sussurratore**. A ogni conversazione racconta
  la voce successiva di un elenco di otto.
- Quattro voci sono indizi veri (pagine, libro al contrario, Balena, pietra); quattro sono false e
  diventano lezioni: voci senza fonte e insider trading, la roulette, "compra sulla voce", le truffe
  con rendimenti garantiti.
- Se un segreto è già stato scoperto, lo fa notare. Scoperti tutti, cambia battuta.

### 2.6 Traguardi segreti

Nell'Agenda i traguardi segreti appaiono come "???" ("Un segreto ancora da scoprire") finché non vengono
sbloccati: `secret_ledger`, `secret_tape`, `secret_whale`, `secret_hodl` e **Cacciatore di Segreti**
(`secret_all`, tutti e quattro), che dà il titolo omonimo e il "Mappamondo delle rotte segrete".

## 3. Indizi vaghi nella storia

Oltre al Sussurratore, alcuni personaggi secondari aggiungono una frase alle loro battute abituali. Gli
indizi sono volutamente imprecisi: indicano una zona, un'abitudine o un giorno, mai la casella. Compaiono
solo dalla Medaglia 4 e spariscono quando il segreto a cui alludono è stato scoperto
(`SECRET_HINTS` in `secretsData.ts`, `secretHint()` in `secrets.ts`).

| Personaggio | Dove | Allude a | Tono dell'indizio |
|---|---|---|---|
| Abitante (`t5_npc1`) | Bilancia | Pagine | fogli portati dal vento, "non dalle strade battute" |
| Abitante (`t6_npc2`) | Valdividendo | Pagine | i tesori stanno negli angoli dove nessuno si ferma |
| Vecchio Minatore | Miniera dei Lingotti | Pagina IV | un foglio "dove la vena si esaurisce" |
| Marinaia | Mare della Liquidità | Pagina V | la Guardiana non guarda mai alle sue spalle |
| Abitante (`t5_npc2`) | Bilancia | Sala del Nastro | un libro che nessuno legge nel verso giusto |
| Storica del Relitto | Mare della Liquidità | Balena | qualcosa di enorme nei giorni in cui la Borsa riposa |
| Abitante (`t2_npc2`) | Porto Ordini | Balena | movimenti grossi al largo nel fine settimana |
| Abitante (`t7_npc1`) | Mentelucida | Mani di Diamante | pietre che parlano a chi resta fermo a lungo |
| Abitante (`t8_npc1`) | Rocca Rischio | Mani di Diamante | una pietra tra i fiori sul percorso per Valdividendo |
| Abitante (`t6_npc1`) | Valdividendo | Sussurratore | al Casinò qualcuno sussurra voci, metà vere |
| Abitante (`t8_npc2`) | Rocca Rischio | Sussurratore | "ascolta chi parla a bassa voce" |

Livelli di precisione, dal più vago al più preciso: abitanti, poi Sussurratore, poi note a matita sulle
pagine. Così chi esplora da solo può arrivarci, e chi è bloccato ha sempre un passo in più.

## 4. Implementazione

| File | Ruolo |
|---|---|
| `src/world/secretsData.ts` | Dati puri: posizioni, testi delle pagine, indizi, flag, `SECRET_BADGE`, `isWeekend()` |
| `src/world/secrets.ts` | Logica: pagine, scaffale, personaggi segreti, voci, rituale, indizi |
| `src/world/maps.ts` | `buildSecrets()`: Sala del Nastro, passaggio segreto, pietra, Balena, Sussurratore; tipo NPC `secret`, lock `secret` |
| `src/world/scripts.ts` | Visibilità e dialogo dei personaggi `secret`; indizi in coda ai personaggi `talk` |
| `src/scenes/world.ts` | Pagine invisibili e scaffale in `interactFront()`, scaffale aperto in `loadMap()`, timer del rituale in `update()` |
| `src/systems/progress.ts` | Traguardi segreti (`secret: true`), evento `secret`, oggetti per la casa |
| `src/ui/agenda.ts` | Traguardi segreti mostrati come "???" |
| `src/systems/music.ts` | Jingle `secret` per ogni scoperta |
| `tests/reachSim.ts` | Simulazione del mondo condivisa (estratta da `reach.test.ts`), con il lock `secret` dalla Medaglia 4 |
| `tests/secrets.test.ts` | Posizioni libere e raggiungibili, Sala chiusa con 3 Medaglie e aperta con 4, Balena solo nel weekend, traguardi, indizi |

Salvataggio: solo flag (`secret_page_p1..p6`, `secret_tape_open`, `secret_tape_won`, `secret_whale`,
`secret_hodl`) e il contatore `rumor`. Nessuna migrazione necessaria.

## 5. Verifica

- `npm test`: tutti i test verdi, incluso il test di raggiungibilità del mondo.
- Prova nel browser con un bot Playwright su salvataggi preparati: raccolta della pagina I con la nota
  per la II; scaffale aperto ed ingresso nella Sala del Nastro; dialogo e duello della Vecchia del Nastro;
  voce del Sussurratore; rituale completato dopo 60 secondi; Balena assente di mercoledì e presente di
  sabato (orologio simulato); con 3 Medaglie la pagina non si trova.

## 6. Idee per il futuro

- Una settima pagina all'Altopiano della Lega, solo dopo il titolo di Campione.
- Variante notturna di un segreto (ad esempio un operatore dell'after-hours che compare solo di notte).
- Una piccola animazione quando lo scaffale scorre.
