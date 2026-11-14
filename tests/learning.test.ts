// Percorso di apprendimento: ogni concetto viene prima esposto e spiegato, poi chiesto.
// - Ogni argomento ha libri e lezioni che spiegano il vocabolario delle sue domande (VOCAB qui sotto è l'elenco dei
//   concetti chiesti: chi aggiunge una domanda su un concetto nuovo lo aggiunge qui e lo spiega in un libro).
// - Fuori dagli Exchange (Percorsi, rivale, speculatori, eremiti, grotte) si chiede solo ciò che è già stato studiato.
// - Chi entra in un Exchange o a Wall Street senza aver aperto i libri trova un avviso sulla porta.
import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { studiedTopics, topicOpened, pickQuestions, pickCaveQuestions, targetDiff, recordAnswer, dailyQuestion, WALL_STREET_TOPICS } from '../src/systems/quiz';
import { mentorTopics, byTopic, QUESTIONS } from '../src/data/quiz/build';
import { BOOKS, booksFor, mentorBooks } from '../src/data/books';
import { LESSONS } from '../src/data/lessons';
import { doorNotice } from '../src/world/scripts/places';
import { getMap, allMapIds } from '../src/world/maps';
import { CAVES, caveOf } from '../src/world/caves';
import { mulberry32 } from '../src/systems/rng';
import type { Question, QuizTopic, Track } from '../src/types';

/** Concetti chiesti dalle domande di ciascun argomento: ognuno deve comparire nei libri o nelle lezioni dell'argomento. */
const VOCAB: Record<QuizTopic, string[]> = {
  rischio: ['volatilità', 'drawdown', 'tolleranza al rischio', 'orizzonte temporale', 'sharpe', 'beta', 'liquidità', 'mercato orso', 'premio per il rischio', 'concentrazione', 'rischio sistematico', 'rischio specifico', 'paper trading', 'titolo di stato a breve'],
  ordini: ['ordine a mercato', 'ordine limite', 'ordine stop', 'stop limit', 'spread', 'slippage', 'allo scoperto', 'giornaliero', 'gap', '9:30', 'riepilogo', 'eseguito', 'poco scambiati'],
  diversificazione: ['correlazione', 'ribilanc', 'rischio specifico', 'rischio di mercato', 'asset allocation', 'geografica', 'sovrapposizione', 'stesso settore', 'classi di attivo'],
  costi: ['interesse composto', 'regola del 72', 'ter', 'piano di accumulo', 'inflazione', 'rendimento reale', 'capitalizzazione', 'commissioni fisse', 'zero commissioni', 'potere d\'acquisto', 'reale netto'],
  bias: ['fomo', 'avversione alle perdite', 'ancoraggio', 'gregge', 'eccesso di fiducia', 'bias di conferma', 'effetto disposizione', 'autoattribuzione', 'recenza', 'sopravvivenza', 'fallacia del giocatore', 'cornice', 'escalation', 'scommettere'],
  gestione: ['leva', 'position sizing', 'stop loss', 'martingala', 'fondo di emergenza', 'margin call', 'rischio/rendimento', 'trailing stop', 'aspettativa', 'gap', 'margine di mantenimento', 'piano scritto', 'peso massimo'],
  macro: ['pil', 'disoccupazione', 'inflazione', 'di fondo', 'stagflazione', 'bce', 'quantitative easing', 'aspettative', 'politica fiscale', 'curva dei rendimenti', 'reinvestimento', 'spread', 'hedged', 'utili trimestrali', 'bene rifugio', 'duration', 'difensivi', 'rendimento reale', 'tasso variabile'],
  analisi: ['analisi fondamentale', 'analisi tecnica', 'media mobile', 'rsi', 'p/e', 'capitalizzazione di mercato', 'supporto', 'resistenza', 'volume', 'trend rialzista', 'overfitting', 'backtest', 'p/bv', 'peg', 'ebitda', 'free cash flow', 'divergenza', 'falsi segnali', 'beta', 'vantaggio competitivo', 'crediti verso clienti', 'rendimenti passati'],
  regole: ['ponzi', 'piramidale', 'pump and dump', 'consob', 'phishing', 'mifid ii', 'adeguatezza', 'appropriatezza', 'kid', 'kyc', 'esma', 'mica', 'insider trading', 'manipolazione', 'front running', 'best execution', 'separat', 'controllo remoto', 'dichiarazione dei redditi', 'autorizzat', 'conflitto di interessi', 'capitale garantito'],
  stocks_base: ['ipo', 'indice azionario', 'large cap', 'growth', 'value', 'split', 'capitalizzazione', 'flottante', 'diritto di voto', 'attese', 'rimborsat', 'domanda e offerta'],
  stocks_bilanci: ['conto economico', 'stato patrimoniale', 'rendiconto finanziario', 'eps', 'p/e', 'patrimonio netto', 'margine operativo', 'ebitda', 'ammortamenti', 'crediti verso clienti', 'flusso di cassa', 'sezione investitori', 'ricavi'],
  stocks_dividendi: ['dividendo', 'rendimento da dividendo', 'payout', 'stacco', 'reinvest', 'buyback', 'rendimento totale', 'aziende mature', 'non è garantito'],
  etf_base: ['replica un indice', 'ter', 'gestione passiva', 's&p 500', 'accumulazione', 'distribuzione', 'leva', 'ponderazione per capitalizzazione', 'ucits', 'spread'],
  etf_replica: ['replica fisica', 'replica sintetica', 'swap', 'tracking error', 'tracking difference', 'kid', 'domicilio', 'nav', 'a campione', 'settoriale', 'world', 'patrimonio del fondo'],
  etf_obbligazioni: ['cedole', 'duration', 'scadenza', 'high yield', 'rating', 'rischio di credito', 'zero coupon', 'indicizzat', 'nominale', 'direzioni opposte'],
  crypto_base: ['blockchain', 'token', 'halving', 'mining', 'proof-of-stake', 'gas fee', 'capitalizzazione', 'mica', '24 ore su 24', 'exchange', 'volatil'],
  crypto_custodia: ['chiave privata', 'seed phrase', 'wallet caldo', 'wallet freddo', 'non custodial', 'hardware wallet', 'irreversibile', 'phishing', '2fa', 'airdrop', 'indirizzo pubblico', 'rete corretta', 'approvare'],
  crypto_stable: ['stablecoin', 'algoritmic', 'defi', 'rug pull', 'staking', 'smart contract', 'riserve', 'ponzi', 'piattaforma centralizzata', 'garanzia sui depositi'],
  mixed_base: ['classi', 'alternativi', 'oro', 'liquidità', 'rischio di cambio', 'profilo di rischio', 'correlazione', 'inflazione'],
  mixed_allocazione: ['asset allocation', 'strategica', 'tattica', 'target date', 'core-satellite', 'deriva', 'soglia', 'bilanciato', '80/20', 'piano di accumulo'],
  grotte: ['bene rifugio', 'tasso reale', 'dark pool', 'iceberg', 'front running', 'best execution', 'valore intrinseco', 'margine di sicurezza', 'trappola del valore', 'valore contabile'],
};

const studyText = (t: QuizTopic) => [...BOOKS.filter((b) => b.topic === t).flatMap((b) => [b.title, ...b.pages]), ...LESSONS.filter((l) => l.topic === t).flatMap((l) => [l.title, ...l.body])].join(' ').toLowerCase();
const TRACKS: Track[] = ['listed', 'crypto', 'mixed'];
const start = (track: Track, badges: number) => { newGame(); S.track = track; S.mixedClasses = track === 'mixed' ? ['stocks', 'crypto'] : []; S.badges = badges; };

describe('ogni argomento è spiegato prima di essere chiesto', () => {
  it('ogni argomento con domande ha libri e lezioni che ne spiegano i concetti', () => {
    const missing: string[] = [];
    for (const t of Object.keys(VOCAB) as QuizTopic[]) {
      expect(byTopic(t).length, `domande di ${t}`).toBeGreaterThan(0);
      const text = studyText(t);
      // le sigle e le parole corte valgono solo come parola intera («ter» non è dentro «interesse»)
      const has = (w: string) => (w.length > 5 ? text.includes(w) : new RegExp(`(^|[^a-zà-ù0-9])${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-zà-ù0-9]|$)`).test(text));
      for (const w of VOCAB[t]) if (!has(w)) missing.push(`${t}: ${w}`);
    }
    expect(missing).toEqual([]);
    // nessun argomento con domande resta fuori dall'elenco
    expect([...new Set(QUESTIONS.map((q) => q.topic))].filter((t) => !(t in VOCAB))).toEqual([]);
  });

  it('ogni argomento ha almeno due libri, e quelli di Wall Street hanno il loro scaffale', () => {
    for (const t of Object.keys(VOCAB) as QuizTopic[]) expect(BOOKS.filter((b) => b.topic === t).length, t).toBeGreaterThanOrEqual(t === 'grotte' ? 3 : 2);
    for (const t of WALL_STREET_TOPICS) expect(booksFor([t]).length, t).toBeGreaterThanOrEqual(3);
    // le pagine stanno nel riquadro dei dialoghi
    for (const b of BOOKS) for (const p of b.pages) expect(p.length, `${b.id}: ${p.slice(0, 40)}`).toBeLessThanOrEqual(400);
  });

  it('la sezione di ogni Whale contiene i libri di approfondimento dei suoi argomenti', () => {
    for (const tr of TRACKS) for (let m = 1; m <= 8; m++) {
      start(tr, m - 1);
      const books = mentorBooks(m, S.track, S.mixedClasses);
      for (const t of mentorTopics(m, S.track, S.mixedClasses)) expect(books.filter((b) => b.topic === t && b.id !== `b_guide_${m}`).length, `${tr} Whale ${m} ${t}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('fuori dagli Exchange si chiede solo ciò che è stato studiato', () => {
  beforeEach(() => start('listed', 0));

  it('prima del primo Attestato valgono gli argomenti della prima Whale (li introduce la sfida di prova)', () => {
    expect(studiedTopics().sort()).toEqual(mentorTopics(1, 'listed', []).sort());
  });

  it('l\'argomento della Whale successiva entra solo dopo aver letto un suo libro o una sua lezione', () => {
    for (const tr of TRACKS) for (let b = 1; b < 8; b++) {
      start(tr, b);
      const next = mentorTopics(b + 1, S.track, S.mixedClasses).filter((t) => !Array.from({ length: b }, (_, i) => mentorTopics(i + 1, S.track, S.mixedClasses)).flat().includes(t));
      for (const t of next) expect(studiedTopics(), `${tr} b${b} ${t}`).not.toContain(t);
      // letto un libro: l'argomento è aperto
      const book = BOOKS.find((x) => x.topic === next[0])!;
      S.booksRead.push(book.id);
      expect(topicOpened(next[0])).toBe(true);
      expect(studiedTopics()).toContain(next[0]);
    }
  });

  it('le regole entrano dopo la prima lezione sulle truffe; macroeconomia e analisi solo con otto Attestati', () => {
    expect(studiedTopics()).not.toContain('regole');
    S.lessonsRead.push('l_regole_1');
    expect(studiedTopics()).toContain('regole');
    S.booksRead.push('b_macro_1');
    expect(studiedTopics()).not.toContain('macro');
    S.badges = 8;
    expect(studiedTopics()).toContain('macro');
    expect(studiedTopics()).not.toContain('analisi');
  });

  it('la domanda del giorno resta tra gli argomenti studiati', () => {
    start('crypto', 3);
    expect(studiedTopics()).toContain(dailyQuestion().topic);
  });

  it('lungo tutto il viaggio i Percorsi non chiedono mai un argomento non ancora studiato, e la difficoltà segue la tappa', () => {
    for (const tr of TRACKS) {
      start(tr, 0);
      const rng = mulberry32(7);
      for (let b = 0; b < 8; b++) {
        S.badges = b;
        const r = b + 1, target = targetDiff(b);
        const studied = studiedTopics();
        const asked: Question[] = [];
        for (const n of getMap(`r${r}`).npcs.filter((x) => x.kind === 'trainer' || (x.kind === 'speculator' && !x.data?.boss))) asked.push(...pickQuestions(studied, 3, { preferReview: true, target, rng }));
        expect(asked.length, `${tr} r${r}`).toBeGreaterThanOrEqual(6);
        for (const q of asked) expect(studied, `${tr} r${r}: ${q.id}`).toContain(q.topic);
        const avg = asked.reduce((a, q) => a + q.diff, 0) / asked.length;
        expect(Math.abs(avg - target), `${tr} r${r} difficoltà ${avg.toFixed(2)} contro ${target}`).toBeLessThanOrEqual(0.4);
        asked.forEach((q) => recordAnswer(q, rng() < 0.75));
        // in città: Biblioteca, allievi e Whale
        const topics = mentorTopics(r, S.track, S.mixedClasses);
        mentorBooks(r, S.track, S.mixedClasses).forEach((x) => S.booksRead.push(x.id));
        pickQuestions(topics, 8, { target, rng }).forEach((q) => { expect(topics).toContain(q.topic); recordAnswer(q, rng() < 0.75); });
      }
    }
  });

  it('nelle grotte le domande sono della grotta, mai viste e del livello della tappa, per ogni sfidante', () => {
    for (const tr of TRACKS) {
      start(tr, 5);
      const rng = mulberry32(11);
      for (const id of allMapIds().filter((m) => caveOf(m))) {
        const k = caveOf(id)!;
        S.badges = k === 'gold' ? 5 : k === 'dp' ? 6 : 7;
        for (const n of getMap(id).npcs.filter((x) => x.kind === 'trainer')) {
          const left = CAVES[k].maps.flatMap((m) => getMap(m).npcs).filter((x) => x.kind === 'trainer' && !S.defeated.includes(x.id)).length;
          S.defeated.push(n.id);
          const qs = pickCaveQuestions(CAVES[k].quiz, 3, targetDiff(S.badges), studiedTopics(), rng, left);
          expect(qs.length).toBe(3);
          for (const q of qs) { expect(q.id.startsWith(`grotte_${CAVES[k].quiz}_`), `${n.id}: ${q.id}`).toBe(true); expect(S.answered[q.id] ?? 0, q.id).toBe(0); recordAnswer(q, true); }
          expect(Math.abs(qs.reduce((a, q) => a + q.diff, 0) / 3 - targetDiff(S.badges)), `${n.id} ${qs.map((q) => q.diff)}`).toBeLessThanOrEqual(0.4);
        }
      }
    }
  });
});

describe('avviso sulla porta per chi non ha ancora studiato', () => {
  it('Exchange: compare una volta sola, e non compare a chi ha aperto i libri', () => {
    start('listed', 1);
    const first = doorNotice('academy_2');
    expect(first?.join(' ')).toContain('Ordini di borsa');
    expect(doorNotice('academy_2')).toBeNull();
    start('listed', 1);
    S.booksRead.push('b_ordini_1');
    expect(doorNotice('academy_2')).toBeNull();
    // l'Exchange di una Whale già battuta, o non ancora raggiungibile, non avvisa
    start('listed', 3);
    expect(doorNotice('academy_2')).toBeNull();
    expect(doorNotice('library_2')).toBeNull();
  });

  it('Wall Street: avvisa chi arriva con otto Attestati senza aver aperto la sua sezione', () => {
    start('listed', 8);
    expect(doorNotice('league')?.join(' ')).toContain('Macroeconomia');
    expect(doorNotice('league')).toBeNull();
    start('listed', 8);
    S.booksRead.push('b_analisi_1');
    expect(doorNotice('league')).toBeNull();
  });
});
