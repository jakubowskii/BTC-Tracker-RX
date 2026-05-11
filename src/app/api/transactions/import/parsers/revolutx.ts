/**
 * Revolut X CSV parser
 *
 * CSV Format:
 * Symbol,Type,Quantity,Price,Value,Fees,Date
 *
 * Example rows:
 * USD,Inne,,,"8,50$","0,00 PLN","3 sty 2025, 08:22:11"
 * BTC,Kupno — Revolut X,"0,00011234","44 500,00$","4,99$","0,00$","3 sty 2025, 08:23:04"
 */

import { BaseParser } from './base';
import { ImportTransaction } from './types';

export class RevolutXParser extends BaseParser {
  name = 'revolutx';

  private readonly requiredHeaders = [
    'symbol',
    'type',
    'quantity',
    'price',
    'value',
    'fees',
    'date',
  ];

  canParse(headers: string[]): boolean {
    const lc = headers.map(h => h.toLowerCase().trim());
    const matchCount = this.requiredHeaders.filter(h => lc.includes(h)).length;

    return matchCount === this.requiredHeaders.length;
  }

  getConfidenceScore(headers: string[]): number {
    const lc = headers.map(h => h.toLowerCase().trim());
    const matchCount = this.requiredHeaders.filter(h => lc.includes(h)).length;

    return (matchCount / this.requiredHeaders.length) * 100;
  }

  private parsePolishNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    let cleaned = value
      .trim()
      .replace(/\s/g, '')
      .replace(/[^\d,.-]/g, '');

    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }

    return parseFloat(cleaned) || 0;
  }

  private parseRevolutDate(dateStr: string): string {
    if (!dateStr) return '';

    const normalized = dateStr
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const monthMap: Record<string, string> = {
      sty: '01',
      lut: '02',
      mar: '03',
      kwi: '04',
      maj: '05',
      cze: '06',
      lip: '07',
      sie: '08',
      wrz: '09',
      paz: '10',
      lis: '11',
      gru: '12',
    };

    const match = normalized.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})/);
    if (!match) {
      return super.parseDate(dateStr);
    }

    const [, day, monthName, year] = match;
    const month = monthMap[monthName];
    if (!month) {
      return super.parseDate(dateStr);
    }

    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  parseTransaction(
    transaction: any,
    _headers: string[],
    _values: string[]
  ): ImportTransaction | null {
    const symbol = (transaction['symbol'] || '').trim().toUpperCase();
    const type = (transaction['type'] || '').trim().toLowerCase();

    // Revolut X exports USD top-ups as "Inne" rows with empty Quantity/Price.
    // Only BTC purchase rows should become tracker transactions.
    if (symbol !== 'BTC' || !type.includes('kupno') || !type.includes('revolut x')) {
      return null;
    }

    const btcAmount = this.parsePolishNumber(transaction['quantity']);
    const pricePerBtc = this.parsePolishNumber(transaction['price']);
    const totalAmount = this.parsePolishNumber(transaction['value']);
    const fees = this.parsePolishNumber(transaction['fees']);
    const transactionDate = this.parseRevolutDate(transaction['date'] || '');

    if (btcAmount <= 0) {
      return null;
    }

    const result: ImportTransaction = {
      type: 'BUY',
      btc_amount: btcAmount,
      original_price_per_btc: pricePerBtc,
      original_currency: 'USD',
      original_total_amount: totalAmount,
      fees,
      fees_currency: 'USD',
      transaction_date: transactionDate,
      notes: 'Revolut X Buy',
    };

    try {
      return this.validateTransaction(result);
    } catch (error) {
      console.error('Revolut X transaction validation failed:', error);
      return null;
    }
  }
}
