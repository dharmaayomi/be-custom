export const formatIDRCurrency = (value: number): string => {
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `Rp. ${formatted}`;
};

export const humanizeEnumLabel = (value: string): string => {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => {
      if (word.length <= 2 || /^\d+$/.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};
