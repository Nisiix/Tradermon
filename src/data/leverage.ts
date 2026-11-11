// Esame della Leva: otto domande, sempre le stesse regole dei duelli. Le cifre sono quelle di Alpaca
// (margine iniziale 50%, mantenimento 30%, 2 volte oltre la giornata) e valgono come esempio didattico.
import type { Question } from '../types';

const q = (id: string, text: string, options: string[], answer: number, explain: string): Question => ({ id: `lev_${id}`, topic: 'gestione', diff: 3, q: text, options, answer, explain, source: 'ig_intro' });

export const LEVERAGE_EXAM: Question[] = [
  q('1', 'Hai 1.000 $ e compri titoli per 2.000 $ usando la leva 2×. Il titolo scende del 10%. Quanto perde il tuo capitale?', ['Il 10%', 'Il 20%', 'Il 5%', 'Nulla finché non vendi'], 1, 'La perdita è 200 $ su 2.000 $ di titoli, ma i soldi tuoi sono 1.000 $: perdi il 20%. La leva moltiplica i ribassi quanto i rialzi.'),
  q('2', 'Con leva 2×, quale ribasso del titolo azzera del tutto il tuo capitale?', ['Circa il 25%', 'Circa il 50%', 'Circa il 100%', 'Non può succedere'], 1, 'Con metà dei titoli comprati a debito, un calo del 50% vale quanto tutto il tuo capitale. Il broker ti liquida molto prima.'),
  q('3', 'Che cos\'è una chiamata di margine (margin call)?', ['Un premio per chi usa la leva', 'La richiesta di rientrare quando il capitale scende sotto il minimo', 'Una telefonata di cortesia del broker', 'Il pagamento di un dividendo'], 1, 'Sotto il margine di mantenimento devi versare denaro o vendere titoli; se non lo fai il broker vende al posto tuo.'),
  q('4', 'Se non copri una chiamata di margine, il broker può...', ['Solo avvisarti di nuovo', 'Vendere i tuoi titoli senza chiederti nulla', 'Aspettare che il prezzo risalga', 'Cancellare il debito'], 1, 'È scritto nel contratto: può liquidare le posizioni senza preavviso e al prezzo del momento, spesso il peggiore.'),
  q('5', 'Il prestito della leva ha un costo?', ['No, è gratuito', 'Sì: un interesse che maturi ogni giorno', 'Solo se guadagni', 'Solo sulle cripto'], 1, 'Paghi un interesse annuo sul denaro preso in prestito, giorno dopo giorno, anche quando il titolo non si muove.'),
  q('6', 'Un titolo perde il 50% e poi guadagna il 50%. Rispetto all\'inizio sei...', ['Tornato in pari', 'Sotto del 25%', 'Sopra del 25%', 'Sotto del 50%'], 1, '100 diventa 50, poi 75. Più grande è la perdita, più grande deve essere il recupero: con la leva le perdite grandi arrivano prima.'),
  q('7', 'Perché la leva rende pericoloso anche un ribasso passeggero?', ['Perché aumenta le tasse', 'Perché la liquidazione forzata rende definitiva la perdita', 'Perché blocca i dividendi', 'Perché vieta gli ordini limite'], 1, 'Senza leva puoi aspettare la ripresa. Con la leva puoi essere liquidato sul minimo e non partecipare al recupero.'),
  q('8', 'Qual è la regola più prudente per chi usa la leva?', ['Usarla sempre al massimo', 'Decidere prima quanto puoi perdere e tenerla bassa', 'Raddoppiare dopo ogni perdita', 'Usarla solo sui titoli di moda'], 1, 'La misura della posizione e una perdita massima decisa in anticipo contano più di qualsiasi previsione.'),
];
