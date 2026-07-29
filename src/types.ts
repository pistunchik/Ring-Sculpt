export interface RingParams {
  innerDiameter: number;
  width: number;
  thickness: number;
}

export interface CartItem {
  id: string;
  name: string;
  ringParams: RingParams;
  materialPreset: string;
  materialName: string;
  materialColorClass: string;
  inscriptionText: string;
  placedInsertsCount: number;
  price: number;
  quantity: number;
  addedAt: string;
  stlBlobUrl?: string;
  stlDataUrl?: string;
}

export interface OrderDetails {
  customerName: string;
  phone: string;
  email: string;
  deliveryMethod: 'courier' | 'pickup' | 'cdek';
  address: string;
  comment: string;
}
