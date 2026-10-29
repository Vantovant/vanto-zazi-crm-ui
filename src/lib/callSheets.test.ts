import { describe, it, expect } from 'vitest';
import { formatLocalPhone, intlDigits, isPhoneOnly, dedupeCards, isNoiseNote } from './callSheets';

describe('call sheets rules', () => {
  it('formats phone as 0xx xxx xxxx', () => {
    expect(formatLocalPhone('+27 79 083 1530')).toBe('079 083 1530');
  });
  it('builds wa.me digits', () => {
    expect(intlDigits('0790831530')).toBe('27790831530');
  });
  it('opt-out means phone only', () => {
    expect(isPhoneOnly({ auto_send_opt_out: true, additional_notes: '' })).toBe(true);
    expect(isPhoneOnly({ auto_send_opt_out: false, additional_notes: 'Does not want WhatsApp' })).toBe(true);
    expect(isPhoneOnly({ auto_send_opt_out: false, additional_notes: 'Prefers calls' })).toBe(false);
  });
  it('never shows two cards for the same aplgo id or phone', () => {
    const rows = [
      { id: 'a', aplgo_id: '123', phone_normalized: '1' },
      { id: 'b', aplgo_id: '123', phone_normalized: '2' },
      { id: 'c', aplgo_id: '', phone_normalized: '1' },
      { id: 'd', aplgo_id: '9', phone_normalized: '9' },
    ];
    expect(dedupeCards(rows).map((r) => r.id)).toEqual(['a', 'd']);
  });
  it('skips October VIP tag note', () => {
    expect(isNoiseNote('Tagged October VIP')).toBe(true);
  });
});
