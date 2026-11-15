import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { newGame, S } from '../src/systems/state';
import { listJoin } from '../src/i18n';
import { missionStars, nextStep, topicCards } from '../src/ui/student';
import { mentorMission } from '../src/data/missions';

// Revisione del 15 novembre 2026: piccoli errori trovati giocando.
describe('revisione 15/11', () => {
  beforeEach(() => { newGame(); });

  it('gli elenchi si leggono come frasi: «a, b e c», non «a e b e c»', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['a'])).toBe('a');
    expect(listJoin(['a', 'b'])).toBe('a e b');
    expect(listJoin(['a', 'b', 'c'])).toBe('a, b e c');
    expect(listJoin([1, 2])).toBe('1 e 2');
  });

  it('nessun testo unisce più di due voci con " e " ripetuto', () => {
    for (const f of ['src/ui/broker.ts', 'src/world/scripts/duels.ts', 'src/world/scripts/places.ts', 'src/systems/account.ts']) {
      expect(readFileSync(f, 'utf8')).not.toContain(".join(T(' e '))");
    }
  });

  it('una missione è «fatta» solo se riuscita nella Zona Simulazione, non per l\'Attestato', () => {
    S.badges = 3;
    expect(missionStars().filter((m) => m.done).length).toBe(0);
    S.flags.m2_mission = true;
    expect(missionStars().map((m) => m.done)).toEqual([false, true, false, false, false, false, false, false]);
  });

  it('il prossimo passo manda a ripetere le missioni nella Zona Simulazione, non dalla Whale', () => {
    S.badges = 3;
    const ms = mentorMission(1, S.track, S.profile);
    if (ms.kind !== 'sim') return;
    S.flags.m1_mission = true;
    S.flags[`${ms.id}_stars`] = 1;
    const txt = nextStep(topicCards());
    expect(txt).toContain('Zona Simulazione');
    expect(txt).not.toContain('Whale');
  });

  it('nel duello la spiegazione sta su una riga sua e il tempo scaduto mostra la risposta giusta', () => {
    const src = readFileSync('src/ui/battle.ts', 'utf8');
    expect(src).toContain('<b class="bad">Tempo scaduto!</b> ${right}');
    expect(src).toContain('<p>${verdict}</p><p>${esc(gtext(q.explain))}</p>');
  });
});
