import { S } from '../systems/state';
import { TOWNS } from '../data/story';

/**
 * Abilità di esplorazione legate alle Medaglie (non sono oggetti né aiuti nei duelli).
 * - Flusso di Liquidità: attraversare l'acqua su una zattera (Medaglia 3, Ribilanciamento: sposti il capitale dove serve).
 * - Trasferimento di Capitale: viaggio rapido dalla Mappa della Regione verso le città già visitate
 *   (Medaglia 4, la Whale di mezzo tra gli otto). Costa un giorno di mercato, come il regolamento T+1.
 * - Mente Fredda (tecnica della Whale 7): attraversa il Muro del Rumore (già presente in world.ts).
 */
export const SWIM_BADGE = 3;
export const TRANSFER_BADGE = 4;

export const ABILITY = {
  swim: { name: 'Flusso di Liquidità', badge: SWIM_BADGE, desc: 'Attraversi l\'acqua su una zattera: la liquidità scorre dove serve. Apre le Isole della Liquidità sui Percorsi 3, 5 e 7 e, dal molo di Porto Ordini, il Mare della Liquidità.' },
  transfer: { name: 'Trasferimento di Capitale', badge: TRANSFER_BADGE, desc: 'Dalla Mappa della Regione sposti il tuo capitale (e te stess{o|a}) in una città già visitata. Il regolamento è T+1: passa un giorno di mercato.' },
  cut: { name: 'Taglio dei Costi', badge: 4, desc: 'Frantumi i Massi delle Commissioni che bloccano sentieri e grotte, come la Galleria del Dark Pool sul Percorso 2.' },
  dark: { name: 'Lanterna della Due Diligence', badge: 5, desc: 'Illumini le grotte buie: la Miniera dei Lingotti (Percorso 5 ↔ Valdividendo) e la Grotta delle Perle nel Mare della Liquidità.' },
  cold: { name: 'Mente Fredda', badge: 7, desc: 'Le notizie urlate non ti smuovono: attraversi il Muro del Rumore sul Percorso 7.' },
} as const;

export function canSwim(): boolean { return S.badges >= SWIM_BADGE; }
export function canTransfer(): boolean { return S.badges >= TRANSFER_BADGE; }
export function canCut(): boolean { return S.badges >= ABILITY.cut.badge; }
export function canSeeDark(): boolean { return S.badges >= ABILITY.dark.badge; }

/** Chiave del salvataggio per un Masso delle Commissioni già frantumato. */
export function boulderFlag(map: string, x: number, y: number) { return `boulder_${map}_${x}_${y}`; }

/** Percorsi con un'Isola della Liquidità (lago a nord del sentiero). */
export const ISLET_ROUTES = [3, 5, 7];

/** Mappa esterna (città o percorso) in cui si trova la mappa data: per gli interni segue l'uscita. */
export function outdoorOf(id: string, get: (id: string) => { interior: boolean; warps: { to: string }[] }): string {
  let cur = id;
  for (let i = 0; i < 4; i++) {
    const m = get(cur);
    if (!m.interior || !m.warps.length) return cur;
    cur = m.warps[0].to;
  }
  return cur;
}

/** Città raggiungibili con il Trasferimento di Capitale (visitate, esclusa quella in cui sei). */
export function transferTargets(here: string): string[] {
  return TOWNS.filter((t) => S.visited.includes(t.id) && t.id !== here).map((t) => t.id);
}

/** Etichette sopra il riquadro (per non sovrapporsi alla strada). */
export const LABEL_ABOVE = new Set(['t2', 't4', 't7', 't9']);

/** Posizioni dei luoghi sulla Mappa della Regione (viewBox 100×62). La strada va da Borgo Semina a Wall Street. */
export const REGION_POS: Record<string, [number, number]> = {
  t0: [10, 47], t1: [28, 52], t2: [45, 44], t3: [62, 51], t4: [80, 45],
  t5: [88, 27], t6: [70, 21], t7: [51, 15], t8: [32, 21], t9: [13, 12],
};
