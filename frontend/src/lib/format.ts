const moneyFormat = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

// Accepts numbers or numeric strings (Postgres DECIMAL arrives as a string)
export function money(value: number | string): string {
  return moneyFormat.format(Number(value));
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}