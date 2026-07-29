export interface ProductVisibilityRecord {
  data: {
    archived?: boolean;
  };
}

export function isPublicProduct<T extends ProductVisibilityRecord>(product: T): boolean {
  return product.data.archived !== true;
}
