export interface RingParams {
  innerDiameter: number;
  width: number;
  thickness: number;
}

export interface EditorSnapshot {
  ringParams: RingParams;
  materialPreset: string;
  inscriptionText: string;
  inscriptionDepth: number;
  inscriptionSize: number;
  inscriptionWeight: number;
  placedInserts: any[];
  sculptedPositions?: number[];
  stlDataUrl?: string;
  stlFileName?: string;
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
  /** JPEG data URL of the canvas at the moment of adding to cart */
  previewDataUrl?: string;
  /** Full editor state to restore when user clicks "Edit" */
  editorSnapshot?: EditorSnapshot;
}

export interface OrderDetails {
  customerName: string;
  phone: string;
  email: string;
  deliveryMethod: 'courier' | 'pickup' | 'cdek';
  address: string;
  comment: string;
}

