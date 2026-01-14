
export interface DataPoint {
  id: string;
  text: string;
  timestamp: number;
}

export enum TabType {
  TABLE = 'table',
  CHART = 'chart',
  CLOUD = 'cloud'
}
