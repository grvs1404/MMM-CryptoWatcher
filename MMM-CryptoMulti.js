/* global Module */

Module.register("MMM-CryptoMulti", {
  defaults: {
    header: "Crypto",
    /**
     * coins: array of coin definitions. Each item can be:
     *  - a CoinGecko coin: { source: "coingecko", id: "bitcoin", label: "BTC" }
     *  - an XPMarket token:   { source: "xpmarket", issuer: "r...", currency: "PLR", label: "PLR" }
     *
     * Example below includes common defaults (edit issuer addresses for XRPL tokens).
     */
    coins: [
      { source: "coingecko", id: "bitcoin", label: "BTC" },
      { source: "coingecko", id: "ethereum", label: "ETH" },
      { source: "coingecko", id: "solana", label: "SOL" },
      { source: "coingecko", id: "cardano", label: "ADA" },
      // XRPL / XPMarket examples (replace issuer with real issuer addresses)
      { source: "xpmarket", issuer: "rEXAMPLE1", currency: "XRP", label: "XRP" },
      { source: "xpmarket", issuer: "rEXAMPLE2", currency: "PLR", label: "PLR" },
      { source: "xpmarket", issuer: "rEXAMPLE3", currency: "ARK", label: "ARK" },
      { source: "xpmarket", issuer: "rEXAMPLE4", currency: "GRIM", label: "GRIM" }
    ],

    // Single vs-currency for display (e.g., usd, xrp)
    vsCurrency: "usd",

    // percent change periods (CoinGecko supports many; XPMarket might provide only 24h or custom keys)
    changePeriods: ["24h", "7d"],

    showHeaders: true,
    updateInterval: 5 * 60 * 1000,
    retryDelay: 30 * 1000,
    apiCoinGecko: "https://api.coingecko.com/api/v3",
    apiXPMarket: "https://api.xpmarket.com/api/v1",

    locale: "en-US",
    fiatRound: 2,
    nonFiatRound: 6,
    debug: false
  },

  start() {
    this.loaded = false;
    this.error = null;
    this.rows = [];
    this.config.vsCurrency = String(this.config.vsCurrency || "usd").toLowerCase();
    this.config.changePeriods = (this.config.changePeriods || ["24h"]).map(p => String(p).toLowerCase());
    this.scheduleUpdate(0);
  },

  getStyles() {
    return ["styles.css"];
  },

  getHeader() {
    return this.config.header;
  },

  scheduleUpdate(delay) {
    setTimeout(() => {
      this.sendSocketNotification("CRYPTO_FETCH", this.config);
    }, delay);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "CRYPTO_DATA") {
      this.loaded = true;
      this.error = null;
      this.rows = payload.rows || [];
      this.updateDom();
      this.scheduleUpdate(this.config.updateInterval);
      return;
    }

    if (notification === "CRYPTO_ERROR") {
      this.loaded = true;
      this.error = payload?.error || String(payload);
      this.updateDom();
      this.scheduleUpdate(this.config.retryDelay);
      return;
    }

    if (notification === "CRYPTO_DEBUG" && this.config.debug) {
      console.log("[MMM-CryptoMulti]", payload);
    }
  },

  isFiat(code) {
    const fiats = new Set(["usd","eur","gbp","cad","aud","jpy","chf","sek","nok","dkk"]);
    return fiats.has(String(code).toLowerCase());
  },

  formatNumber(value, vsCurrency) {
    const decimals = this.isFiat(vsCurrency) ? this.config.fiatRound : this.config.nonFiatRound;
    return new Intl.NumberFormat(this.config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(value);
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "cryptomulti-wrapper";

    if (!this.loaded) {
      wrapper.className = "dimmed light small";
      wrapper.innerText = "Loading…";
      return wrapper;
    }

    if (this.error) {
      wrapper.className = "small bright";
      wrapper.innerText = `Error: ${this.error}`;
      return wrapper;
    }

    if (!this.rows.length) {
      wrapper.className = "dimmed small";
      wrapper.innerText = "No data available.";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "small cryptomulti-table";

    const periods = (this.config.changePeriods || []).map(p => String(p).toLowerCase());
    const vs = String(this.config.vsCurrency).toUpperCase();

    if (this.config.showHeaders) {
      const hr = document.createElement("tr");
      hr.className = "cryptomulti-header-row";
      hr.innerHTML = `
        <th class="left">Coin</th>
        <th class="right">Price (${vs})</th>
        ${periods.map(p => `<th class="right">${p.toUpperCase()}</th>`).join("")}
      `;
      table.appendChild(hr);
    }

    this.rows.forEach(r => {
      const tr = document.createElement("tr");
      const name = r.label || r.name || r.id || r.currency || "";
      tr.innerHTML = `
        <td class="left">${name} <span class="dimmed">(${String(r.symbol || r.currency || "").toUpperCase()})</span></td>
        <td class="right">${this.formatNumber(r.price, this.config.vsCurrency)} <span class="dimmed">${vs}</span></td>
        ${periods.map(p => {
          const pct = Number(r.changes?.[p]);
          if (Number.isFinite(pct)) {
            const cls = pct > 0 ? "pos" : (pct < 0 ? "neg" : "flat");
            return `<td class="right"><span class="${cls}">${pct.toFixed(2)}%</span></td>`;
          } else {
            return `<td class="right"><span class="dimmed">—</span></td>`;
          }
        }).join("")}
      `;
      table.appendChild(tr);
    });

    wrapper.appendChild(table);
    return wrapper;
  }
});
