import type { Source } from '../types';
import { T } from '../i18n';

// Fonti citate nelle spiegazioni dei quiz e nelle lezioni.
// Gli URL di Investor.gov, Banca d'Italia, CFA Institute ed ESMA sono stati controllati il 9/11/2026.
// Gli URL di Investopedia seguono lo schema stabile /terms/<lettera>/<voce>.asp.
const IG = 'SEC – Investor.gov';
const IP = 'Investopedia';

export const SOURCES: Record<string, Source> = {
  ig_intro: { title: 'Introduction to Investing', publisher: IG, url: 'https://www.investor.gov/introduction-investing' },
  ig_market_order: { title: 'Market Order', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/market-order' },
  ig_stop_order: { title: 'Stop Order', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/stop-order' },
  ig_order_types: { title: 'Types of Orders', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders' },
  ig_diversify: { title: 'Diversify Your Investments', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments' },
  ig_allocation: { title: 'Asset Allocation', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/asset-allocation' },
  ig_compound: { title: 'Compound Interest Calculator', publisher: IG, url: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator' },
  ig_dividend: { title: 'Dividend', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/dividend' },
  ig_ponzi: { title: 'Ponzi Scheme', publisher: IG, url: 'https://www.investor.gov/protect-your-investments/fraud/types-fraud/ponzi-scheme' },
  ig_pump: { title: 'Pump-and-Dump Schemes', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/pump-and-dump-schemes' },
  ig_etf: { title: 'Exchange-Traded Funds (ETFs)', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-2' },
  ig_funds: { title: 'Mutual Funds', publisher: IG, url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-funds-etfs/mutual-funds' },

  ip_stock: { title: 'Stock', publisher: IP, url: 'https://www.investopedia.com/terms/s/stock.asp' },
  ip_etf: { title: 'Exchange-Traded Fund (ETF)', publisher: IP, url: 'https://www.investopedia.com/terms/e/etf.asp' },
  ip_crypto: { title: 'Cryptocurrency', publisher: IP, url: 'https://www.investopedia.com/terms/c/cryptocurrency.asp' },
  ip_blockchain: { title: 'Blockchain', publisher: IP, url: 'https://www.investopedia.com/terms/b/blockchain.asp' },
  ip_sharpe: { title: 'Sharpe Ratio', publisher: IP, url: 'https://www.investopedia.com/terms/s/sharperatio.asp' },
  ip_mdd: { title: 'Maximum Drawdown (MDD)', publisher: IP, url: 'https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp' },
  ip_beta: { title: 'Beta', publisher: IP, url: 'https://www.investopedia.com/terms/b/beta.asp' },
  ip_volatility: { title: 'Volatility', publisher: IP, url: 'https://www.investopedia.com/terms/v/volatility.asp' },
  ip_spread: { title: 'Bid-Ask Spread', publisher: IP, url: 'https://www.investopedia.com/terms/b/bid-askspread.asp' },
  ip_dca: { title: 'Dollar-Cost Averaging (DCA)', publisher: IP, url: 'https://www.investopedia.com/terms/d/dollarcostaveraging.asp' },
  ip_rebalancing: { title: 'Rebalancing', publisher: IP, url: 'https://www.investopedia.com/terms/r/rebalancing.asp' },
  ip_eps: { title: 'Earnings Per Share (EPS)', publisher: IP, url: 'https://www.investopedia.com/terms/e/eps.asp' },
  ip_pe: { title: 'Price-to-Earnings (P/E) Ratio', publisher: IP, url: 'https://www.investopedia.com/terms/p/price-earningsratio.asp' },
  ip_de: { title: 'Debt-to-Equity (D/E) Ratio', publisher: IP, url: 'https://www.investopedia.com/terms/d/debtequityratio.asp' },
  ip_tracking: { title: 'Tracking Error', publisher: IP, url: 'https://www.investopedia.com/terms/t/trackingerror.asp' },
  ip_synthetic: { title: 'Synthetic ETF', publisher: IP, url: 'https://www.investopedia.com/terms/s/synthetic-etf.asp' },
  ip_ter: { title: 'Expense Ratio', publisher: IP, url: 'https://www.investopedia.com/terms/e/expenseratio.asp' },
  ip_index_fund: { title: 'Index Fund', publisher: IP, url: 'https://www.investopedia.com/terms/i/indexfund.asp' },
  ip_stablecoin: { title: T('Stablecoin'), publisher: IP, url: 'https://www.investopedia.com/terms/s/stablecoin.asp' },
  ip_private_key: { title: 'Private Key', publisher: IP, url: 'https://www.investopedia.com/terms/p/private-key.asp' },
  ip_seed: { title: 'Seed Phrase', publisher: IP, url: 'https://www.investopedia.com/terms/s/seed-phrase.asp' },
  ip_rugpull: { title: 'Rug Pull', publisher: IP, url: 'https://www.investopedia.com/terms/r/rug-pull-crypto.asp' },
  ip_defi: { title: 'Decentralized Finance (DeFi)', publisher: IP, url: 'https://www.investopedia.com/terms/d/defi.asp' },
  ip_loss_aversion: { title: 'Loss Aversion', publisher: IP, url: 'https://www.investopedia.com/terms/l/lossaversion.asp' },
  ip_anchoring: { title: 'Anchoring', publisher: IP, url: 'https://www.investopedia.com/terms/a/anchoring.asp' },
  ip_herd: { title: 'Herd Instinct', publisher: IP, url: 'https://www.investopedia.com/terms/h/herdinstinct.asp' },
  ip_fomo: { title: 'Fear of Missing Out (FOMO)', publisher: IP, url: 'https://www.investopedia.com/terms/f/fear-missing-out-fomo.asp' },
  ip_overconfidence: { title: 'Overconfidence Bias', publisher: IP, url: 'https://www.investopedia.com/terms/o/overconfidence-bias.asp' },
  ip_rule72: { title: 'Rule of 72', publisher: IP, url: 'https://www.investopedia.com/terms/r/ruleof72.asp' },
  ip_inflation: { title: 'Inflation', publisher: IP, url: 'https://www.investopedia.com/terms/i/inflation.asp' },
  ip_stoploss: { title: 'Stop-Loss Order', publisher: IP, url: 'https://www.investopedia.com/terms/s/stop-lossorder.asp' },
  ip_position_sizing: { title: 'Position Sizing', publisher: IP, url: 'https://www.investopedia.com/terms/p/positionsizing.asp' },
  ip_leverage: { title: 'Leverage', publisher: IP, url: 'https://www.investopedia.com/terms/l/leverage.asp' },
  ip_bond: { title: 'Bond', publisher: IP, url: 'https://www.investopedia.com/terms/b/bond.asp' },
  ip_duration: { title: 'Duration', publisher: IP, url: 'https://www.investopedia.com/terms/d/duration.asp' },
  ip_yield_curve: { title: 'Yield Curve', publisher: IP, url: 'https://www.investopedia.com/terms/y/yieldcurve.asp' },
  ip_central_bank: { title: 'Central Bank', publisher: IP, url: 'https://www.investopedia.com/terms/c/centralbank.asp' },
  ip_correlation: { title: 'Correlation', publisher: IP, url: 'https://www.investopedia.com/terms/c/correlation.asp' },
  ip_compound: { title: 'Compound Interest', publisher: IP, url: 'https://www.investopedia.com/terms/c/compoundinterest.asp' },
  ip_drip: { title: 'Dividend Reinvestment Plan (DRIP)', publisher: IP, url: 'https://www.investopedia.com/terms/d/dividendreinvestmentplan.asp' },
  ip_payout: { title: 'Payout Ratio', publisher: IP, url: 'https://www.investopedia.com/terms/p/payoutratio.asp' },
  ip_market_cap: { title: 'Market Capitalization', publisher: IP, url: 'https://www.investopedia.com/terms/m/marketcapitalization.asp' },
  ip_moving_avg: { title: 'Moving Average (MA)', publisher: IP, url: 'https://www.investopedia.com/terms/m/movingaverage.asp' },
  ip_rsi: { title: 'Relative Strength Index (RSI)', publisher: IP, url: 'https://www.investopedia.com/terms/r/rsi.asp' },
  ip_fundamental: { title: 'Fundamental Analysis', publisher: IP, url: 'https://www.investopedia.com/terms/f/fundamentalanalysis.asp' },
  ip_technical: { title: 'Technical Analysis', publisher: IP, url: 'https://www.investopedia.com/terms/t/technicalanalysis.asp' },
  ip_liquidity: { title: 'Liquidity', publisher: IP, url: 'https://www.investopedia.com/terms/l/liquidity.asp' },
  ip_bear: { title: 'Bear Market', publisher: IP, url: 'https://www.investopedia.com/terms/b/bearmarket.asp' },
  ip_phishing: { title: 'Phishing', publisher: IP, url: 'https://www.investopedia.com/terms/p/phishing.asp' },
  ip_mifid: { title: 'MiFID II', publisher: IP, url: 'https://www.investopedia.com/terms/m/mifid-ii.asp' },
  ip_martingale: { title: 'Martingale System', publisher: IP, url: 'https://www.investopedia.com/terms/m/martingalesystem.asp' },
  ip_house_edge: { title: 'House Edge', publisher: IP, url: 'https://www.investopedia.com/terms/h/houseedge.asp' },
  ip_paper: { title: 'Paper Trade', publisher: IP, url: 'https://www.investopedia.com/terms/p/paper-trade.asp' },
  ip_asset_alloc: { title: 'Asset Allocation', publisher: IP, url: 'https://www.investopedia.com/terms/a/assetallocation.asp' },

  bdi: { title: "L'economia per tutti", publisher: "Banca d'Italia", url: 'https://economiapertutti.bancaditalia.it/' },
  consob: { title: T('Educazione finanziaria'), publisher: 'Consob', url: 'https://www.consob.it/web/investor-education' },
  cfa: { title: 'Investment Foundations', publisher: 'CFA Institute', url: 'https://www.cfainstitute.org/' },
  esma: { title: T('Avvertenze per gli investitori'), publisher: 'ESMA', url: 'https://www.esma.europa.eu/' },
};

export function sourceLabel(key: string): string {
  const s = SOURCES[key];
  return s ? `${s.publisher}: ${s.title}` : '';
}
