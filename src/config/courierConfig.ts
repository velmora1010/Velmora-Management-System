export const ACTIVE_COURIERS = ['ST Courier'];

export const isCourierActive = (courierName: string | undefined | null): boolean => {
  if (!courierName) return false;
  return ACTIVE_COURIERS.includes(courierName);
};
