export const getDpAmount = (grandTotal: number): number => {
  return Math.floor(Math.ceil(grandTotal) / 4);
};

export const logNotificationErrors = (
  results: PromiseSettledResult<unknown>[],
  orderId: string,
  label: string,
): void => {
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const target = index === 0 ? "USER" : "ADMIN";
      console.error(
        `[Order ${orderId}] Failed to create ${target} ${label} notification:`,
        result.reason,
      );
    }
  });
};
