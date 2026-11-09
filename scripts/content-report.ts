// Genera docs/02-CONTENUTI-E-FONTI.md a partire dai dati del gioco: `npm run docs:content`.
import { writeFileSync } from 'node:fs';
import { QUESTIONS } from '../src/data/quiz/build';
import { SOURCES } from '../src/data/sources';
import { LESSONS } from '../src/data/lessons';
import { ASSETS, SECTOR_LABEL } from '../src/data/assets';

const byTopic = new Map<string, number>();
const bySource = new Map<string, number>();
for (const q of QUESTIONS) { byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1); bySource.set(q.source, (bySource.get(q.source) ?? 0) + 1); }
for (const l of LESSONS) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);

let md = `# Tradermon · Contenuti e fonti\n\nDocumento generato dai dati del gioco (\`npm run docs:content\`). Ogni domanda e ogni lezione cita una fonte pubblica di educazione finanziaria, mostrata al giocatore con il link dopo la risposta.\n\n`;
md += `## In numeri\n\n- Domande: **${QUESTIONS.length}** in ${byTopic.size} argomenti\n- Lezioni: **${LESSONS.length}**\n- Asset didattici (di fantasia): **${ASSETS.length}**\n- Fonti: **${Object.keys(SOURCES).length}**\n\n`;
md += `## Domande per argomento\n\n| Argomento | Domande |\n|---|---:|\n${[...byTopic].map(([t, n]) => `| ${t} | ${n} |`).join('\n')}\n\n`;
md += `## Fonti\n\n| Editore | Titolo | Citazioni | Link |\n|---|---|---:|---|\n${Object.entries(SOURCES).map(([k, s]) => `| ${s.publisher} | ${s.title} | ${bySource.get(k) ?? 0} | ${s.url} |`).join('\n')}\n\n`;
md += `## Lezioni\n\n${LESSONS.map((l) => `- **${l.title}** (${l.topic}) · fonte: ${SOURCES[l.source]?.publisher ?? l.source}`).join('\n')}\n\n`;
md += `## Asset didattici\n\nTutti di fantasia: nessun nome reale, così il gioco non suggerisce titoli da comprare.\n\n| Ticker | Nome | Classe | Settore | Rischio |\n|---|---|---|---|---|\n${ASSETS.map((a) => `| ${a.ticker} | ${a.name} | ${a.cls} | ${SECTOR_LABEL[a.sector]} | ${'★'.repeat(a.risk)} |`).join('\n')}\n\n`;
md += `## Come vengono scritte le domande\n\n1. Ogni domanda nasce da un concetto spiegato in una delle fonti elencate, riformulato in italiano semplice.\n2. La risposta corretta è una sola; le opzioni sbagliate sono errori tipici dei principianti.\n3. La spiegazione dice perché la risposta è giusta e rimanda alla fonte.\n4. I test automatici (\`npm test\`) controllano che ogni domanda abbia una fonte esistente, nessuna opzione duplicata e che ogni Mentore abbia abbastanza domande.\n`;
writeFileSync(new URL('../docs/02-CONTENUTI-E-FONTI.md', import.meta.url), md);
console.log('docs/02-CONTENUTI-E-FONTI.md aggiornato');
