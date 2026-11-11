# Configurazione della landing

## donazioni.json

Indirizzi per le donazioni in crypto. Se la lista è vuota, il pulsante "♥ Dona" non compare.
Ogni riga diventa una scheda nel riquadro (indirizzo, pulsante Copia e QR code generato nel browser).

```json
{
  "indirizzi": [
    { "rete": "Solana", "valute": "SOL, USDC", "indirizzo": "IL_TUO_INDIRIZZO" },
    { "rete": "Bitcoin", "valute": "BTC", "indirizzo": "IL_TUO_INDIRIZZO" }
  ]
}
```

Controlla l'indirizzo due volte: le transazioni crypto non si possono annullare.
Il file viene incluso al momento del build, quindi dopo una modifica serve un nuovo deploy (push su main).
