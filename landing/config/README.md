# Configurazione della landing

## donazioni.json

Donazioni facoltative, mostrate in un breve invito sopra "Un gioco per imparare".

- `paypal`: il tuo link PayPal, per esempio `https://paypal.me/TUONOME` (vanno bene solo indirizzi `paypal.me` o `paypal.com`). Se è vuoto, il pulsante "Dona con PayPal" non compare.
- `indirizzi`: indirizzi per le donazioni in crypto. Se la lista è vuota, il pulsante "♥ Dona in crypto" non compare.

Se mancano entrambi, l'invito non compare affatto.
Ogni riga diventa una scheda nel riquadro (indirizzo, pulsante Copia e QR code generato nel browser).

```json
{
  "paypal": "https://paypal.me/TUONOME",
  "indirizzi": [
    { "rete": "Solana", "valute": "SOL, USDC", "indirizzo": "IL_TUO_INDIRIZZO" },
    { "rete": "Bitcoin", "valute": "BTC", "indirizzo": "IL_TUO_INDIRIZZO" }
  ]
}
```

Controlla l'indirizzo due volte: le transazioni crypto non si possono annullare.
Il file viene incluso al momento del build, quindi dopo una modifica serve un nuovo deploy (push su main).

## segnalazioni.json

Indirizzo email che riceve le segnalazioni dal modulo "Segnala un problema" nel footer della landing.
Se `email` è vuoto, il link non compare.

```json
{ "email": "segnalazioni@esempio.it" }
```

Il modulo non invia nulla da solo: prepara il messaggio e lo apre nel programma di posta del giocatore, che lo spedisce a questo indirizzo.
Anche questo file viene incluso al momento del build: dopo una modifica serve un nuovo deploy (push su main).
