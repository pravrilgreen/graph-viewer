import ELK from 'elkjs/lib/elk.bundled.js';
import { Edge, Node } from 'reactflow';
import { GraphModel, GraphTransition, XYPoint } from './types';

const elk = new ELK();

export const NODE_LAYOUT_WIDTH = 300;
export const NODE_LAYOUT_HEIGHT = 200;

type LayoutResult = {
  nodes: Node[];
  edges: Edge[];
};

const toRoutePoints = (layoutEdge: any): XYPoint[] => {
  const section = layoutEdge?.sections?.[0];
  if (!section) {
    return [];
  }

  const startPoint = section.startPoint || null;
  const endPoint = section.endPoint || null;
  const bends = Array.isArray(section.bendPoints) ? section.bendPoints : [];
  const points = [startPoint, ...bends, endPoint].filter(Boolean);
  return points.map((point: any) => ({ x: point.x, y: point.y }));
};

const buildReactFlowEdge = (transition: GraphTransition, routePoints: XYPoint[]): Edge => ({
  id: transition.id,
  source: transition.from,
  target: transition.to,
  type: 'default',
  data: {
    transition,
    from_screen: transition.from,
    to_screen: transition.to,
    action_type: transition.action.type,
    description: transition.action.description,
    conditionIds: transition.conditions.ids,
    actionParams: transition.action.params,
    weight: transition.metrics.weight,
    routePoints,
  },
});

export const buildGraphLayout = async (graph: GraphModel): Promise<LayoutResult> => {
  const elkGraph = {
    id: 'graph-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.spacing.nodeNodeBetweenLayers': '340',
      'elk.spacing.nodeNode': '180',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=88,left=120,bottom=88,right=120]',
    },
    children: graph.screens.map((screen) => ({
      id: screen.id,
      width: NODE_LAYOUT_WIDTH,
      height: NODE_LAYOUT_HEIGHT,
    })),
    edges: graph.transitions.map((transition) => ({
      id: transition.id,
      sources: [transition.from],
      targets: [transition.to],
    })),
  };

  const layout = await elk.layout(elkGraph as any);
  const edgeRoutes = new Map<string, XYPoint[]>();

  (layout.edges || []).forEach((layoutEdge: any) => {
    edgeRoutes.set(layoutEdge.id, toRoutePoints(layoutEdge));
  });

  const nodes: Node[] = graph.screens.map((screen) => {
    const layoutNode = (layout.children || []).find((candidate: any) => candidate.id === screen.id);
    const x = layoutNode?.x || 0;
    const y = layoutNode?.y || 0;

    return {
      id: screen.id,
      type: 'custom',
      position: { x, y },
      draggable: false,
      data: {
        label: screen.id,
        imagePath: screen.imagePath,
      },
    };
  });

  const edges = graph.transitions.map((transition) => {
    const routePoints = edgeRoutes.get(transition.id) || [];
    return buildReactFlowEdge(transition, routePoints);
  });

  return { nodes, edges };
};
