export type VehicleProductStatus = 'available' | 'on-sale' | 'coming-soon';

export function vehicleSaleStateForStatus(status: VehicleProductStatus) {
  return { status, onSale: status === 'on-sale' };
}

export function vehicleSaleStateForToggle(currentStatus: VehicleProductStatus, onSale: boolean) {
  return {
    status: onSale ? 'on-sale' as const : currentStatus === 'on-sale' ? 'available' as const : currentStatus,
    onSale,
  };
}
