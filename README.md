# MMM-CryptoWatcher

A MagicMirror² module that displays multiple cryptocurrencies in a single table while allowing per-coin data sources.

Supported data sources:
- **CoinGecko** — general purpose, large-cap coins (BTC, ETH, SOL, ADA, ...).
- **XPMarket** — XRPL-native tokens and orderbook data (XRP, PLR, ARK, GRIM, ...).

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/grvs1404/MMM-CryptoWatcher.git
```

## Example config

```js
{
  module: "MMM-CryptoWatcher",
  position: "bottom_left",
  config: {
    vsCurrency: "usd",
    changePeriods: ["24h","7d"],
    coins: [
      { source: "coingecko", id: "bitcoin", label: "BTC" },
      { source: "coingecko", id: "ethereum", label: "ETH" },
      { source: "coingecko", id: "solana", label: "SOL" },
      { source: "coingecko", id: "cardano", label: "ADA" },
      { source: "xpmarket", issuer: "rEXAMPLE1", currency: "XRP", label: "XRP" },
      { source: "xpmarket", issuer: "rEXAMPLE2", currency: "PLR", label: "PLR" }
    ]
  }
},
```

### Notes

- For XPMarket tokens, you **must** provide the issuer address (the account on the XRP Ledger that issues the token). Replace `rEXAMPLE1` etc. with the real issuers.
- CoinGecko entries use CoinGecko IDs (e.g., `bitcoin`, `ethereum`, `ripple`).
- The module requests CoinGecko in a single batched call and queries XPMarket per-token.
- XPMarket's exact fields may vary; the module tries common fields (`last_price`, `price`, `change_24h`, etc.) and falls back gracefully.

## Troubleshooting

- If you see `No data available.` check `pm2 logs mm` for module debug output.
- To enable debug:
  ```js
  config: { ..., debug: true }
  ```
  Then check logs for the constructed request URLs.

## License
MIT
