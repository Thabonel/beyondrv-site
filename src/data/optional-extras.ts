export type ProductCategory = 'slide-on' | 'caravan' | 'expedition';

export interface OptionalExtra {
  id: string;
  label: string;
  price: number;
  allowedProductCategories: ProductCategory[];
  available: boolean;
}

export interface OptionalExtraCategory {
  category: string;
  items: OptionalExtra[];
}

const ALL_VEHICLE_CATEGORIES: ProductCategory[] = ['slide-on', 'caravan', 'expedition'];

export const OPTIONAL_EXTRA_CATEGORIES: OptionalExtraCategory[] = [
  {
    category: 'Power & Electrical',
    items: [
      { id: 'battery', label: 'Extra 200Ah battery', price: 1500, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
      { id: 'inverter', label: 'Upgrade to 3000W Redarc inverter', price: 3500, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
      { id: 'solar', label: 'Additional 200W solar panel', price: 500, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
  {
    category: 'Heating & Cooling',
    items: [
      { id: 'heater-aufocus', label: '2kW AuFocus diesel heater supply and install', price: 2000, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
      { id: 'heater-truma', label: 'Upgrade to Truma Combi D6 diesel air and water heater', price: 3500, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
  {
    category: 'Connectivity',
    items: [
      { id: 'starlink', label: 'Starlink Mini supply and install', price: 1500, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
  {
    category: 'Water Systems',
    items: [
      { id: 'greywater', label: '40L greywater tank with 12V sump pump', price: 1000, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
  {
    category: 'Exterior Finish',
    items: [
      { id: 'gelcoat-colour', label: 'Custom gel-coat colour matching', price: 3000, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
  {
    category: 'Vehicle Connection',
    items: [
      { id: 'anderson', label: 'Anderson Plug supply and install to vehicle', price: 300, allowedProductCategories: ALL_VEHICLE_CATEGORIES, available: true },
    ],
  },
];

export const OPTIONAL_EXTRAS = OPTIONAL_EXTRA_CATEGORIES.flatMap((category) => category.items);

export function getOptionalExtraById(id: string) {
  return OPTIONAL_EXTRAS.find((extra) => extra.id === id);
}
