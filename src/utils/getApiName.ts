import { APIS } from '../constants/apis';
import { Connection } from '../types/Connection';

export const getApiName = (connection: Connection) => {
  const name = APIS?.find((api) => api.id === connection.unified_api)?.name;
  return name || connection.unified_api;
};
