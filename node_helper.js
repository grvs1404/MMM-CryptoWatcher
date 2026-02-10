const NodeHelper = require("node_helper");
const fetch = global.fetch || require('node-fetch');

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

module.exports = NodeHelper.create({
  async socketNotificationReceived(notification, config) {
    if (notification !== "CRYPTO_FETCH") return;

    try {
      const coins = (config.coins || []).map(c => c || {}).filter(Boolean);
      const cgCoins = coins.filter(c => String(c.source || "coingecko").toLowerCase() === "coingecko");
      const xpCoins = coins.filter(c => String(c.source || "").toLowerCase() === "xpmarket");

      const periods = (config.changePeriods || ["24h"]).map(p => String(p).toLowerCase());

      const rows = [];

      // Fetch CoinGecko in batches (single request for all coingecko ids)
      if (cgCoins.length) {
        const ids = cgCoins.map(c => c.id).filter(Boolean).join(',');
        const url = new URL(`${config.apiCoinGecko}/coins/markets`);
        url.searchParams.set('vs_currency', config.vsCurrency || 'usd');
        url.searchParams.set('ids', ids);
        url.searchParams.set('per_page', String(config.perPage || 250));
        url.searchParams.set('page', '1');
        url.searchParams.set('sparkline', 'false');
        url.searchParams.set('price_change_percentage', periods.join(','));

        if (config.debug) {
          this.sendSocketNotification("CRYPTO_DEBUG", { url: url.toString() });
        }

        const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`CoinGecko HTTP ${res.status}: ${txt.slice(0,250)}`);
        }
        const data = await res.json();

        data.forEach(c => {
          const changes = {};
          for (const p of periods) {
            const k1 = `price_change_percentage_${p}_in_currency`;
            const k2 = `price_change_percentage_${p}`;
            changes[p] = (c[k1] ?? c[k2]) === null || (c[k1] ?? c[k2]) === undefined ? undefined : Number(c[k1] ?? c[k2]);
          }

          rows.push({
            source: 'coingecko',
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            price: c.current_price,
            changes
          });
        });
      }

      // Fetch XPMarket per token
      if (xpCoins.length) {
        for (const token of xpCoins) {
          const issuer = token.issuer;
          const currency = token.currency;
          const label = token.label || currency;
          // Try XPMarket token detail endpoint
          // example: /tokens/{issuer}/{currency}
          const url = new URL(`${config.apiXPMarket}/tokens/${encodeURIComponent(issuer)}/${encodeURIComponent(currency)}`);
          if (config.debug) {
            this.sendSocketNotification("CRYPTO_DEBUG", { url: url.toString() });
          }
          try {
            const r = await fetch(url.toString(), { headers: { accept: 'application/json' } });
            if (!r.ok) {
              // try orderbook or alternate endpoint
              const txt = await r.text();
              throw new Error(`XPMarket HTTP ${r.status}: ${txt.slice(0,200)}`);
            }
            const j = await r.json();
            // j may include fields like last_price, price, price_24h, price_change_24h, change_24h, price_7d, etc.
            const price = j.last_price ?? j.price ?? j.lastPrice ?? j.last ?? undefined;
            const changes = {};
            // map common change keys heuristically
            const mapKeys = {
              '1h': ['change_1h','price_change_1h','price_change_percentage_1h','price_change_1h_in_currency'],
              '24h': ['change_24h','price_change_24h','price_change_percentage_24h','price_change_24h_in_currency'],
              '7d': ['change_7d','price_change_7d','price_change_percentage_7d','price_change_7d_in_currency'],
              '30d': ['change_30d','price_change_30d','price_change_percentage_30d','price_change_30d_in_currency'],
              '1y': ['change_1y','price_change_1y','price_change_percentage_1y','price_change_1y_in_currency']
            };
            for (const p of periods) {
              let val;
              const keys = mapKeys[p] || [];
              for (const k of keys) {
                if (j && Object.prototype.hasOwnProperty.call(j,k)) {
                  val = j[k];
                  break;
                }
              }
              changes[p] = (val === null || val === undefined) ? undefined : Number(val);
            }

            rows.push({
              source: 'xpmarket',
              id: `${currency}:${issuer}`,
              name: label,
              symbol: currency,
              price: price === undefined ? undefined : Number(price),
              changes
            });

          } catch (err) {
            // silently push empty row with error flagged
            rows.push({
              source: 'xpmarket',
              id: `${currency}:${issuer}`,
              name: label,
              symbol: currency,
              price: undefined,
              changes: {},
              error: String(err)
            });
          }
        }
      }

      // Merge rows preserving coin order as configured
      const ordered = [];
      for (const cfg of coins) {
        const match = rows.find(r => {
          if ((cfg.source||'').toLowerCase()==='coingecko') return r.source==='coingecko' && r.id===cfg.id;
          if ((cfg.source||'').toLowerCase()==='xpmarket') return r.source==='xpmarket' && r.id===`${cfg.currency}:${cfg.issuer}`;
          return false;
        });
        if (match) ordered.push(Object.assign({ label: cfg.label || cfg.currency || cfg.id }, match));
        else {
          // placeholder empty row
          ordered.push({
            source: cfg.source || 'unknown',
            id: cfg.id || `${cfg.currency}:${cfg.issuer}`,
            name: cfg.label || cfg.id || cfg.currency,
            symbol: cfg.currency || cfg.id || '',
            price: undefined,
            changes: {},
            error: 'no data'
          });
        }
      }

      this.sendSocketNotification("CRYPTO_DATA", { rows: ordered });
    } catch (err) {
      this.sendSocketNotification("CRYPTO_ERROR", { error: err?.message || String(err) });
    }
  }
});
