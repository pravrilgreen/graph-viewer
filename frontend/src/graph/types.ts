export interface GraphScreen {
  id: string;
  imagePath: string;
}

export interface TransitionActionInfo {
  type: string;
  description: string;
  params: Record<string, string>;
}

export interface TransitionConditionsInfo {
  ids: string[];
}

export interface TransitionMetricsInfo {
  weight: number;
}

export interface GraphTransition {
  id: string;
  from: string;
  to: string;
  action: TransitionActionInfo;
  conditions: TransitionConditionsInfo;
  metrics: TransitionMetricsInfo;
}

export interface GraphModel {
  screens: GraphScreen[];
  transitions: GraphTransition[];
}

export interface XYPoint {
  x: number;
  y: number;
}
