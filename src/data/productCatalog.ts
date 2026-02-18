export interface Product {
  name: string;
  range: 'Daily' | 'Premium' | 'Elite';
  priceIncVat: number;
  pv: number;
}

export const productCatalog: Product[] = [
  // Daily Range — 20 PV each, R431.25 incl. VAT
  { name: 'GRW', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'GTS', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'NRM', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'RLX', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'SLD', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'STP', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'PWR Lemon', range: 'Daily', priceIncVat: 431.25, pv: 20 },
  { name: 'PWR Apricot', range: 'Daily', priceIncVat: 431.25, pv: 20 },

  // Premium Range — 50 PV each, R1,035.00 incl. VAT
  { name: 'ALT', range: 'Premium', priceIncVat: 1035.00, pv: 50 },
  { name: 'HPR', range: 'Premium', priceIncVat: 1035.00, pv: 50 },
  { name: 'HRT', range: 'Premium', priceIncVat: 1035.00, pv: 50 },
  { name: 'ICE', range: 'Premium', priceIncVat: 1035.00, pv: 50 },
  { name: 'MLS', range: 'Premium', priceIncVat: 1035.00, pv: 50 },
  { name: 'LFT', range: 'Premium', priceIncVat: 1035.00, pv: 50 },

  // Elite Range
  { name: 'BTY', range: 'Elite', priceIncVat: 1380.00, pv: 70 },
  { name: 'AIR', range: 'Elite', priceIncVat: 1380.00, pv: 70 },
  { name: 'HPY', range: 'Elite', priceIncVat: 1380.00, pv: 70 },
  { name: 'BRN', range: 'Elite', priceIncVat: 1380.00, pv: 70 },
  { name: 'PFT', range: 'Elite', priceIncVat: 1552.50, pv: 60 },
  { name: 'TERRA Pendant', range: 'Elite', priceIncVat: 1725.00, pv: 40 },
];
