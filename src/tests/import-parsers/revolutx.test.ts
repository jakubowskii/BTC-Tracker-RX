import { parseCsvFile } from '@/app/api/transactions/import/parsers';

const sampleCsv = `Symbol,Type,Quantity,Price,Value,Fees,Date
USD,Inne,,,"8,50$","0,00 PLN","3 sty 2025, 08:22:11"
BTC,Kupno — Revolut X,"0,00011234","44 500,00$","4,99$","0,00$","3 sty 2025, 08:23:04"
BTC,Kupno — Revolut X,"0,00107000","46 728,97$","50,00$","0,02$","26 lut 2025, 13:16:10"`;

describe('RevolutXParser', () => {
  it('detects Revolut X CSV files', () => {
    const result = parseCsvFile(sampleCsv, true);

    expect(result.detectedFormat).toBe('revolutx');
  });

  it('imports BTC buys and skips USD top-ups', () => {
    const result = parseCsvFile(sampleCsv);

    expect(result.detectedFormat).toBe('revolutx');
    expect(result.transactions).toHaveLength(2);
  });

  it('parses Polish decimal amounts, USD fees, and Polish dates', () => {
    const result = parseCsvFile(sampleCsv);
    const first = result.transactions[0];
    const second = result.transactions[1];

    expect(first).toMatchObject({
      type: 'BUY',
      btc_amount: 0.00011234,
      original_price_per_btc: 44500,
      original_currency: 'USD',
      original_total_amount: 4.99,
      fees: 0,
      fees_currency: 'USD',
      transaction_date: '2025-01-03',
      notes: 'Revolut X Buy',
    });

    expect(second).toMatchObject({
      btc_amount: 0.00107,
      original_price_per_btc: 46728.97,
      original_total_amount: 50,
      fees: 0.02,
      transaction_date: '2025-02-26',
    });
  });
});
