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

## titolare.json

Chi gestisce Tradermon, mostrato nell'informativa sulla privacy (`/privacy/`). Serve per legge: chi gioca deve
sapere a chi rivolgersi per i propri dati.

```json
{ "nome": "Nome e cognome", "contatto": "indirizzo@email.it" }
```

`contatto` può essere un'email (diventa un link "scrivi a") oppure un indirizzo `https://`. Finché i campi sono
vuoti la pagina lo dice in chiaro ("da indicare"). Anche questo file entra nel build: dopo una modifica serve un
nuovo deploy.
