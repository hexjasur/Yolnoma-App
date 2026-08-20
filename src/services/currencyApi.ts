import { api } from './api';

export interface CurrencyItem {
  name: string;
  symbol: string;
  flag: string;
}

export interface CurrencyList {
  [code: string]: CurrencyItem;
}

export interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  result: number;
  date: string;
  lastUpdated: string;
  provider: string;
}

export interface HistoricalPoint {
  date: string;
  rate: number;
}

export interface HistoricalResult {
  base: string;
  quote: string;
  range: string;
  startDate: string;
  endDate: string;
  points: HistoricalPoint[];
  currentRate?: number;
  source: string;
}

// Client-side cache for instant responses
let cachedCurrencies: CurrencyList | null = null;

export const currencyApi = {
  /**
   * Get all supported currencies with names, flags and symbols
   */
  async getCurrencies(): Promise<CurrencyList> {
    if (cachedCurrencies) return cachedCurrencies;
    const res = await api.get('/api/v2/currencies');
    const data = res?.data || res;
    cachedCurrencies = data;
    return data;
  },

  /**
   * Convert an amount between currencies
   */
  async convert(amount: number, from: string, to: string): Promise<ConversionResult> {
    const res = await api.get(`/api/v2/convert?amount=${amount}&from=${from}&to=${to}`);
    return res?.data || res;
  },

  /**
   * Get historical rates for chart
   */
  async getHistorical(base: string, quote: string, range: string = '1M'): Promise<HistoricalResult> {
    const res = await api.get(`/api/v2/rates/${base}/${quote}?range=${range}`);
    return res?.data || res;
  },
};
