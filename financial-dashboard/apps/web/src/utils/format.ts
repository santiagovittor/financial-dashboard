export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function fmtOriginal(amount: number, currency: string): string {
  if (currency === 'ARS') return '';
  return `${amount.toLocaleString('es-AR')} ${currency}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function toMonthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
