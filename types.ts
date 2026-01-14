
export interface DataPoint {
  id: string;
  text: string;
  timestamp: number;
}

export enum TabType {
  TABLE = 'table',
  CHART = 'chart',
  CLOUD = 'cloud',
  ANALYSIS = 'analysis'
}

export interface AnalysisResult {
  sentiment: string;
  summary: string;
  keyThemes: string[];
}
