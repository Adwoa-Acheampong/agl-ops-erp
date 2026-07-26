/**
 * Ghana indirect tax stack — applies to taxable supplies of goods and
 * services (parts and workmanship at AGL). Rates are the standard regime
 * effective for the 2026 fiscal year:
 *
 *   • NHIL    — National Health Insurance Levy           2.5%
 *   • GETFund — Ghana Education Trust Fund Levy          2.5%
 *   • COVID   — COVID-19 Health Recovery Levy            1.0%
 *   • VAT     — Value Added Tax (standard rate)         15.0%
 *
 * NHIL + GETFund + COVID are levies that are NOT subject to input-tax
 * recovery and are computed on the net price BEFORE VAT. VAT is then
 * computed on (net + levies). The effective combined burden on the net
 * price comes out to ~21.9%.
 *
 *   levies      = net  × (NHIL + GETFund + COVID)        = net  × 0.06
 *   vatBase     = net + levies
 *   vat         = vatBase × 0.15
 *   grossTotal  = vatBase + vat
 *
 * For zero-rated supplies (e.g. exports) call computeGhanaTax({ rateMode:
 * 'zero-rated' }) — returns 0 for every component.
 *
 * Discounts are applied to the net price BEFORE tax (a true price reduction
 * for VAT purposes), per GRA practice on documented discounts.
 */

export const GHANA_TAX = {
  NHIL: 0.025,
  GETFUND: 0.025,
  COVID: 0.01,
  VAT: 0.15,
} as const;

// Total of pre-VAT levies, computed once.
export const GHANA_PRE_VAT_LEVIES = GHANA_TAX.NHIL + GHANA_TAX.GETFUND + GHANA_TAX.COVID;

export type GhanaTaxMode = 'standard' | 'zero-rated' | 'exempt';

export interface GhanaTaxBreakdown {
  netBeforeDiscount: number;
  discount: number;
  net: number;
  nhil: number;
  getfund: number;
  covid: number;
  leviesSubtotal: number;
  vatBase: number;
  vat: number;
  totalTax: number;
  gross: number;
}

export interface ComputeGhanaTaxInput {
  /** Pre-tax, pre-discount line subtotal in GHS. */
  netBeforeDiscount: number;
  /** Optional absolute discount in GHS. Use this OR discountPct, not both. */
  discount?: number;
  /** Optional discount as fraction of net (0–1). 0.10 = 10% off. */
  discountPct?: number;
  /** Defaults to 'standard'. 'exempt' / 'zero-rated' produce zero tax. */
  rateMode?: GhanaTaxMode;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeGhanaTax(input: ComputeGhanaTaxInput): GhanaTaxBreakdown {
  const netBefore = Math.max(0, input.netBeforeDiscount);
  const discount = input.discount !== undefined
    ? Math.max(0, Math.min(netBefore, input.discount))
    : input.discountPct !== undefined
      ? Math.max(0, Math.min(1, input.discountPct)) * netBefore
      : 0;
  const net = netBefore - discount;
  const mode: GhanaTaxMode = input.rateMode ?? 'standard';

  if (mode !== 'standard') {
    return {
      netBeforeDiscount: round2(netBefore),
      discount: round2(discount),
      net: round2(net),
      nhil: 0, getfund: 0, covid: 0, leviesSubtotal: 0,
      vatBase: round2(net),
      vat: 0, totalTax: 0,
      gross: round2(net),
    };
  }

  const nhil    = net * GHANA_TAX.NHIL;
  const getfund = net * GHANA_TAX.GETFUND;
  const covid   = net * GHANA_TAX.COVID;
  const leviesSubtotal = nhil + getfund + covid;
  const vatBase = net + leviesSubtotal;
  const vat = vatBase * GHANA_TAX.VAT;
  const totalTax = leviesSubtotal + vat;
  const gross = vatBase + vat;

  return {
    netBeforeDiscount: round2(netBefore),
    discount: round2(discount),
    net: round2(net),
    nhil: round2(nhil),
    getfund: round2(getfund),
    covid: round2(covid),
    leviesSubtotal: round2(leviesSubtotal),
    vatBase: round2(vatBase),
    vat: round2(vat),
    totalTax: round2(totalTax),
    gross: round2(gross),
  };
}

/** Format a GHS amount with thousands separators and two decimals. */
export function ghs(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
