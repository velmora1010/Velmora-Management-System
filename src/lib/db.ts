import Dexie, { Table } from 'dexie';

export interface Shipment {
  awb: string;
  orderId: string;
  status: string;
  state: string;
  lastLocation: string;
  trackingDateTime: string;
  department: 'Tamil Nadu' | 'Other State' | 'Unknown';
  lastSyncedAt: number; // timestamp
}

export interface Extraction {
  id: string;
  imageName: string;
  orderId: string;
  awb: string;
  awbConfidence: number;
  status: 'Pending' | 'Extracting' | 'Success' | 'Failed' | 'Needs Review';
  uploadedAt: number;
  fileBlob?: Blob; // For manual cropping later
  updatedAt?: string;
  manualEdited?: boolean;
}

export class AppDB extends Dexie {
  shipments!: Table<Shipment, string>;
  extractions!: Table<Extraction, string>;

  constructor() {
    super('STCourierDB');
    this.version(1).stores({
      shipments: 'awb, orderId, status, state, department, lastSyncedAt'
    });
    this.version(2).stores({
      extractions: 'id, imageName, awb, status, uploadedAt'
    });
  }
}

export const db = new AppDB();
