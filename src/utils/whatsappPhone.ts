import { normalizePhone } from './contactNormalization';

function normalizeCountry(raw: string | undefined | null): string {
  return (raw ?? '').trim().toLowerCase();
}

function isSouthAfrica(country: string): boolean {
  return country.includes('south africa') || country === 'sa' || country.includes('rsa');
}

function isLesotho(country: string): boolean {
  return country.includes('lesotho');
}

export function formatWhatsAppPhone(
  rawPhone: string | undefined | null,
  country: string | undefined | null,
): string | null {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;

  const digits = normalized.replace(/^00/, '');
  const normalizedCountry = normalizeCountry(country);

  if (/^\d{11,15}$/.test(digits)) {
    return digits;
  }

  if (isSouthAfrica(normalizedCountry)) {
    if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
    if (/^\d{9}$/.test(digits)) return `27${digits}`;
  }

  if (isLesotho(normalizedCountry)) {
    if (/^0\d{8}$/.test(digits)) return `266${digits.slice(1)}`;
    if (/^\d{8}$/.test(digits)) return `266${digits}`;
  }

  return null;
}

export function buildWhatsAppUrl(
  rawPhone: string | undefined | null,
  country: string | undefined | null,
  message?: string,
): string | null {
  const phone = formatWhatsAppPhone(rawPhone, country);
  if (!phone) return null;

  if (!message) {
    return `https://wa.me/${phone}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}