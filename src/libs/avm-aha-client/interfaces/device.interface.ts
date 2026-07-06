export interface Device {
  ain: string;
  identifier?: string;
  name: string;
  present: boolean;
  manufacturer?: string;
  productName?: string;
  temperature?: number;
  humidity?: number;
}
