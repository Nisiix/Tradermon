# Modelli esterni per il mondo 2.5D (facoltativi)

Il gioco genera tutti gli oggetti dalla propria pixel art. Se vuoi sostituirne alcuni con modelli 3D veri,
metti qui i file `.glb` e un `manifest.json`:

```json
{
  "models": { "tree": "tree.glb", "fence": "fence.glb", "sign": "sign.glb" },
  "scale": { "tree": 1.4 },
  "lift": { "sign": 0.02 }
}
```

- Le chiavi sono i nomi dei tile in minuscolo: `tree`, `fence`, `sign`, `station`, `gate`, `plant`, `shelf`, `pc`,
  `arcade`, `aquarium`, `globe`, `radio`, `trophy_s`, `trophy_g`, `trophy_l`, `boulder`, `rock`, `ledge`,
  `counter`, `table`, `desk`, `bed`, `roulette`, `case_table`.
- Ogni modello viene scalato a una cella di larghezza (×`scale`) e appoggiato a terra (+`lift`).
- Dove vengono i modelli: pacchetti CC0 (Kenney, KayKit, Quaternius) oppure generatori con piano gratuito
  (Meshy, Tripo) con `node scripts/ai-assets.mjs`. Controlla sempre la licenza: niente modelli estratti da altri giochi.
- Senza `manifest.json` non cambia nulla: il mondo usa gli oggetti in rilievo generati dal gioco.
