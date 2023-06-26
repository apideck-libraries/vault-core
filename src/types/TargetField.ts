export interface TargetField {
  id?: string;
  name: string;
  description: string;
  resourceId: string;
  originFields?: OriginField[];
}

export interface OriginField {
  connectorId: string;
  name: string;
}
