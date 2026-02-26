import ELK from 'elkjs/lib/elk.bundled.js';
import { Edge, Node } from 'reactflow';
import { GraphModel, GraphTransition, XYPoint } from './types';

const elk = new ELK();

const BASE_NODE_LAYOUT_WIDTH = 300;
const BASE_NODE_LAYOUT_HEIGHT = 200;
const BASE_MEDIA_HEIGHT = 150;
const COMPONENT_GAP_X = 420;
const BASE_PARALLEL_EDGE_STEP = 14;

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeGraphScale = (graph: GraphModel) => {
  const degreeMap = new Map<string, number>();
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, number>();
  graph.screens.forEach((screen) => degreeMap.set(screen.id, 0));
  graph.transitions.forEach((transition) => {
    degreeMap.set(transition.from, (degreeMap.get(transition.from) || 0) + 1);
    degreeMap.set(transition.to, (degreeMap.get(transition.to) || 0) + 1);
    outgoingMap.set(transition.from, (outgoingMap.get(transition.from) || 0) + 1);
    incomingMap.set(transition.to, (incomingMap.get(transition.to) || 0) + 1);
  });

  const maxDegree = Math.max(...degreeMap.values(), 0);
  const maxSideLoad = graph.screens.reduce((peak, screen) => {
    const incoming = incomingMap.get(screen.id) || 0;
    const outgoing = outgoingMap.get(screen.id) || 0;
    return Math.max(peak, incoming, outgoing);
  }, 0);
  // Automatic scale based on side pressure (incoming/outgoing) around node boundaries.
  // Side-based load is more accurate than total degree for layered layouts.
  const dynamicPortSpacing = 14 + Math.sqrt(Math.max(maxDegree, 1)) * 1.8;
  const requiredSideSpan = maxSideLoad * dynamicPortSpacing;
  const nodeScaleByWidth = (requiredSideSpan * 0.62) / BASE_NODE_LAYOUT_WIDTH;
  const nodeScaleByHeight = requiredSideSpan / (BASE_NODE_LAYOUT_HEIGHT * 0.92);
  const nodeScale = Math.max(1, nodeScaleByWidth, nodeScaleByHeight);
  const lineScale = clamp(1 / Math.sqrt(nodeScale), 0.28, 1);
  const normalized = clamp((nodeScale - 1) / 4, 0, 1);
  const nodeWidth = Math.round(BASE_NODE_LAYOUT_WIDTH * nodeScale);
  const nodeHeight = Math.round(BASE_NODE_LAYOUT_HEIGHT * nodeScale);
  const mediaHeight = Math.max(Math.round(nodeHeight * 0.84), Math.round(BASE_MEDIA_HEIGHT * nodeScale));

  return {
    maxDegree,
    maxSideLoad,
    dynamicPortSpacing,
    nodeScale,
    lineScale,
    normalized,
    nodeWidth,
    nodeHeight,
    mediaHeight,
  };
};

type GraphScale = ReturnType<typeof computeGraphScale>;

const buildReactFlowEdge = (transition: GraphTransition, routePoints: XYPoint[]): Edge => ({
  id: transition.id,
  source: transition.from,
  target: transition.to,
  type: 'default',
  data: {
    transition,
    transition_id: transition.id,
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

const buildPairKey = (from: string, to: string) => `${from}=>${to}`;

const getParallelOffset = (index: number, count: number, scale: GraphScale) => {
  if (count <= 1) {
    return 0;
  }

  const centeredIndex = index - (count - 1) / 2;
  const maxCenteredDistance = Math.max(1, (count - 1) / 2);
  const preferredStep = BASE_PARALLEL_EDGE_STEP * (1 + scale.normalized * 0.55);
  const maxAbsOffset = Math.max(scale.nodeWidth, scale.nodeHeight) * 1.1 + scale.dynamicPortSpacing * 6;
  const maxFeasibleStep = Math.max(6, maxAbsOffset / maxCenteredDistance);
  const minStep = Math.min(Math.max(10, preferredStep * 0.68), maxFeasibleStep);
  const step = clamp(preferredStep, minStep, maxFeasibleStep);

  return centeredIndex * step;
};

const offsetRoutePoints = (
  routePoints: XYPoint[],
  sourceCenter: XYPoint | undefined,
  targetCenter: XYPoint | undefined,
  offset: number,
): XYPoint[] => {
  if (offset === 0 || routePoints.length < 2 || !sourceCenter || !targetCenter) {
    return routePoints;
  }

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    return routePoints;
  }

  const normalX = -dy / length;
  const normalY = dx / length;

  return routePoints.map((point) => ({
    x: point.x + normalX * offset,
    y: point.y + normalY * offset,
  }));
};

const findConnectedComponents = (graph: GraphModel): string[][] => {
  const screenIds = graph.screens.map((screen) => screen.id);
  const adjacency = new Map<string, Set<string>>();

  screenIds.forEach((id) => adjacency.set(id, new Set<string>()));

  graph.transitions.forEach((transition) => {
    if (!adjacency.has(transition.from)) {
      adjacency.set(transition.from, new Set<string>());
    }
    if (!adjacency.has(transition.to)) {
      adjacency.set(transition.to, new Set<string>());
    }
    adjacency.get(transition.from)!.add(transition.to);
    adjacency.get(transition.to)!.add(transition.from);
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  screenIds.forEach((start) => {
    if (visited.has(start)) {
      return;
    }

    const queue = [start];
    const component: string[] = [];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const neighbors = adjacency.get(current) || new Set<string>();
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    components.push(component);
  });

  return components.sort((a, b) => b.length - a.length);
};

export const buildGraphLayout = async (graph: GraphModel): Promise<LayoutResult> => {
  const scale = computeGraphScale(graph);
  const components = findConnectedComponents(graph);
  const totalNetworks = components.length;
  const screenToNetwork = new Map<string, number>();
  components.forEach((component, index) => {
    component.forEach((screenId) => screenToNetwork.set(screenId, index));
  });

  const positionByScreen = new Map<string, { x: number; y: number }>();
  const edgeRoutes = new Map<string, XYPoint[]>();

  let offsetX = 0;
  const offsetY = 0;

  for (let networkIndex = 0; networkIndex < components.length; networkIndex += 1) {
    const componentScreens = components[networkIndex];
    const componentIdSet = new Set(componentScreens);
    const componentTransitions = graph.transitions.filter(
      (transition) => componentIdSet.has(transition.from) && componentIdSet.has(transition.to),
    );

    const elkGraph = {
      id: `component-${networkIndex}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(
          Math.round(260 * scale.nodeScale + scale.dynamicPortSpacing * 8),
        ),
        'elk.spacing.nodeNode': String(Math.round(180 * scale.nodeScale + scale.dynamicPortSpacing * 5)),
        'elk.spacing.edgeNode': String(Math.round(scale.dynamicPortSpacing * 1.9)),
        'elk.spacing.edgeEdge': String(Math.round(scale.dynamicPortSpacing * 2.35)),
        'elk.layered.spacing.edgeEdgeBetweenLayers': String(Math.round(scale.dynamicPortSpacing * 2.7)),
        'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.round(scale.dynamicPortSpacing * 2.6)),
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.padding': '[top=88,left=120,bottom=88,right=120]',
      },
      children: componentScreens.map((screenId) => ({
        id: screenId,
        width: scale.nodeWidth,
        height: scale.nodeHeight,
      })),
      edges: componentTransitions.map((transition) => ({
        id: transition.id,
        sources: [transition.from],
        targets: [transition.to],
      })),
    };

    const layout = await elk.layout(elkGraph as any);
    const componentWidth = Number(layout?.width) || 0;

    (layout.children || []).forEach((layoutNode: any) => {
      positionByScreen.set(layoutNode.id, {
        x: (layoutNode.x || 0) + offsetX,
        y: (layoutNode.y || 0) + offsetY,
      });
    });

    (layout.edges || []).forEach((layoutEdge: any) => {
      const routePoints = toRoutePoints(layoutEdge).map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      }));
      edgeRoutes.set(layoutEdge.id, routePoints);
    });

    offsetX += componentWidth + COMPONENT_GAP_X;
  }

  const nodes: Node[] = graph.screens.map((screen) => {
    const position = positionByScreen.get(screen.id) || { x: 0, y: 0 };
    const networkId = screenToNetwork.get(screen.id) || 0;

    return {
      id: screen.id,
      type: 'custom',
      position,
      draggable: false,
      style: {
        width: scale.nodeWidth,
        height: scale.nodeHeight,
      },
      data: {
        label: screen.id,
        imagePath: screen.imagePath,
        networkId,
        totalNetworks,
        mediaHeight: scale.mediaHeight,
        nodeScale: scale.nodeScale,
      },
    };
  });

  const nodeCenters = new Map<string, XYPoint>();
  nodes.forEach((node) => {
    nodeCenters.set(node.id, {
      x: node.position.x + scale.nodeWidth / 2,
      y: node.position.y + scale.nodeHeight / 2,
    });
  });

  const pairBuckets = new Map<string, GraphTransition[]>();
  graph.transitions.forEach((transition) => {
    const pairKey = buildPairKey(transition.from, transition.to);
    const current = pairBuckets.get(pairKey) || [];
    current.push(transition);
    pairBuckets.set(pairKey, current);
  });
  pairBuckets.forEach((bucket) => {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
  });

  const edges = graph.transitions.map((transition) => {
    const routePoints = edgeRoutes.get(transition.id) || [];
    const pairKey = buildPairKey(transition.from, transition.to);
    const pairTransitions = pairBuckets.get(pairKey) || [transition];
    const pairIndex = pairTransitions.findIndex((item) => item.id === transition.id);
    const offset = getParallelOffset(pairIndex < 0 ? 0 : pairIndex, pairTransitions.length, scale);
    const offsetPoints = offsetRoutePoints(
      routePoints,
      nodeCenters.get(transition.from),
      nodeCenters.get(transition.to),
      offset,
    );

    const edge = buildReactFlowEdge(transition, offsetPoints);
    return {
      ...edge,
      data: {
        ...edge.data,
        networkId: screenToNetwork.get(transition.from) || 0,
        parallelOffset: offset,
        parallelCount: pairTransitions.length,
        lineScale: scale.lineScale,
      },
    };
  });

  return { nodes, edges };
};
