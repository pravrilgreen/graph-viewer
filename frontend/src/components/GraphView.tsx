import React, { useMemo } from 'react';
import {
  Background,
  Connection,
  Controls,
  Edge,
  Node,
  NodeTypes,
  Position,
  ReactFlow,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (node: Node) => void;
  onEdgeClick: (edge: Edge) => void;
  onPaneClick: () => void;
  focusNodeId?: string | null;
  focusVersion?: number;
  focusPathNodeIds?: string[] | null;
  focusPathVersion?: number;
  isPathFinding?: boolean;
  activeNetworkId?: number | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  highlightedPaths?: string[][];
  highlightedTransitionIds?: string[];
}

const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes = { default: CustomEdge };

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const getNodeRect = (node: Node) => {
  const styleWidth = node.style && typeof node.style === 'object' ? (node.style as any).width : undefined;
  const styleHeight = node.style && typeof node.style === 'object' ? (node.style as any).height : undefined;
  const width = toNumber((node as any).width ?? styleWidth, 320);
  const height = toNumber((node as any).height ?? styleHeight, 196);
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height,
  };
};

const getClosestPositions = (source: Node | undefined, target: Node | undefined) => {
  if (!source || !target) {
    return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
  }

  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sourcePosition: Position.Right, targetPosition: Position.Left }
      : { sourcePosition: Position.Left, targetPosition: Position.Right };
  }

  return dy > 0
    ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    : { sourcePosition: Position.Top, targetPosition: Position.Bottom };
};

const GraphView: React.FC<GraphViewProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  focusNodeId,
  focusVersion = 0,
  focusPathNodeIds,
  focusPathVersion = 0,
  isPathFinding = false,
  activeNetworkId = null,
  selectedNodeId,
  selectedEdgeId,
  highlightedPaths = [],
  highlightedTransitionIds = [],
}) => {
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);
  const pendingRouteFitFrame = React.useRef<number | null>(null);
  const previousNetworkIdRef = React.useRef<number | null | undefined>(undefined);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const normalizedHighlightedPaths = useMemo(
    () => highlightedPaths.filter((path) => Array.isArray(path) && path.length > 1),
    [highlightedPaths],
  );
  const hasActivePath = normalizedHighlightedPaths.length > 0;
  const hasSelectionFocus = Boolean(selectedNodeId || selectedEdgeId);
  const shouldDimByPath = hasActivePath && !hasSelectionFocus;
  const nodeNetworkMap = useMemo(() => {
    const mapping = new Map<string, number>();
    nodes.forEach((node: any) => {
      const networkId = node?.data?.networkId;
      if (typeof networkId === 'number') {
        mapping.set(node.id, networkId);
      }
    });
    return mapping;
  }, [nodes]);
  const densityTuning = useMemo(() => {
    const filteredNodeCount =
      activeNetworkId === null
        ? nodes.length
        : nodes.filter((node: any) => node?.data?.networkId === activeNetworkId).length;
    const filteredEdgeCount =
      activeNetworkId === null
        ? edges.length
        : edges.filter(
            (edge) =>
              nodeNetworkMap.get(edge.source) === activeNetworkId &&
              nodeNetworkMap.get(edge.target) === activeNetworkId,
          ).length;
    const nodeCount = Math.max(filteredNodeCount, 1);
    const edgePerNode = filteredEdgeCount / nodeCount;
    const normalized = Math.max(0, Math.min(1, (edgePerNode - 1.8) / 6.5));
    const strokeScale = Math.max(0.62, 1 - normalized * 0.34);
    const canvasPadding = 0.22 + normalized * 0.09;
    const routePadding = 0.32 + normalized * 0.1;
    const fitMaxZoom = 1.8 - normalized * 0.65;
    const nodeFocusMaxZoom = 2.2 - normalized * 0.9;

    return {
      normalized,
      strokeScale,
      canvasPadding,
      routePadding,
      fitMaxZoom: Math.max(1.05, fitMaxZoom),
      nodeFocusMaxZoom: Math.max(1.1, nodeFocusMaxZoom),
    };
  }, [activeNetworkId, nodes, edges, nodeNetworkMap]);

  const pathNodeSet = useMemo(() => {
    const nodeIds = new Set<string>();
    normalizedHighlightedPaths.forEach((path) => {
      path.forEach((screenId) => nodeIds.add(screenId));
    });
    return nodeIds;
  }, [normalizedHighlightedPaths]);

  const pathEdgeSet = useMemo(() => {
    const edgeIds = new Set<string>();
    normalizedHighlightedPaths.forEach((path) => {
      for (let idx = 0; idx < path.length - 1; idx += 1) {
        edgeIds.add(`${path[idx]}->${path[idx + 1]}`);
      }
    });
    return edgeIds;
  }, [normalizedHighlightedPaths]);
  const highlightedTransitionIdSet = useMemo(() => new Set(highlightedTransitionIds), [highlightedTransitionIds]);

  const selectedNeighborNodeSet = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }
    const neighbors = new Set<string>([selectedNodeId]);
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) {
        neighbors.add(edge.target);
      }
      if (edge.target === selectedNodeId) {
        neighbors.add(edge.source);
      }
    });
    return neighbors;
  }, [edges, selectedNodeId]);

  const selectedEdgeNodeSet = useMemo(() => {
    if (!selectedEdgeId) {
      return new Set<string>();
    }
    const selected = edges.find((edge) => edge.id === selectedEdgeId);
    if (!selected) {
      return new Set<string>();
    }
    return new Set<string>([selected.source, selected.target]);
  }, [edges, selectedEdgeId]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === selectedNodeId,
          isHighlighted:
            pathNodeSet.has(node.id) ||
            selectedNeighborNodeSet.has(node.id) ||
            selectedEdgeNodeSet.has(node.id),
          isDimmed:
            (shouldDimByPath && !pathNodeSet.has(node.id)) ||
            (hasSelectionFocus &&
              !selectedNeighborNodeSet.has(node.id) &&
              !selectedEdgeNodeSet.has(node.id) &&
              node.id !== selectedNodeId),
        },
        style: {
          ...(node.style || {}),
          opacity: isPathFinding
            ? 0.2
            : (shouldDimByPath && !pathNodeSet.has(node.id)) ||
                (hasSelectionFocus &&
                  !selectedNeighborNodeSet.has(node.id) &&
                  !selectedEdgeNodeSet.has(node.id) &&
                  node.id !== selectedNodeId)
              ? 0.22
              : 1,
        },
      })),
    [
      nodes,
      pathNodeSet,
      shouldDimByPath,
      selectedNodeId,
      selectedNeighborNodeSet,
      selectedEdgeNodeSet,
      hasSelectionFocus,
      isPathFinding,
    ],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const isPathHighlighted =
          highlightedTransitionIdSet.size > 0
            ? highlightedTransitionIdSet.has(edge.id)
            : pathEdgeSet.has(`${edge.source}->${edge.target}`);
        const isNeighborHighlighted = selectedNodeId
          ? edge.source === selectedNodeId || edge.target === selectedNodeId
          : false;
        const isEndpointHighlighted =
          selectedEdgeNodeSet.size > 0 &&
          selectedEdgeNodeSet.has(edge.source) &&
          selectedEdgeNodeSet.has(edge.target);
        const isHighlighted = isPathHighlighted || isNeighborHighlighted || isEndpointHighlighted;
        const isSelected = edge.id === selectedEdgeId;
        const edgeBend = 0;
        const globalLineScale =
          typeof (edge.data as any)?.lineScale === 'number' ? Math.max(0.5, (edge.data as any).lineScale) : 1;

        const { sourcePosition, targetPosition } = getClosestPositions(
          nodeMap.get(edge.source),
          nodeMap.get(edge.target),
        );

        return {
          ...edge,
          interactionWidth: Math.max(14, 28 * globalLineScale),
          sourcePosition,
          targetPosition,
          data: {
            ...(edge.data || {}),
            isSelected,
            isHighlighted,
            isDimmed: (shouldDimByPath || hasSelectionFocus) && !isHighlighted && !isSelected,
            edgeBend,
            onEdgeLabelClick: () => onEdgeClick(edge),
          },
          style: {
            ...(edge.style || {}),
            stroke: isPathFinding ? '#94a3b8' : isSelected ? '#f59e0b' : isHighlighted ? '#2563eb' : '#94a3b8',
            strokeWidth:
              (isSelected ? 3.2 : isHighlighted ? 2.8 : 2) * densityTuning.strokeScale * globalLineScale,
            opacity: isPathFinding
              ? 0.12
              : (shouldDimByPath || hasSelectionFocus) && !isHighlighted && !isSelected
                ? 0.16
                : 1,
          },
        };
      }),
    [
      edges,
      pathEdgeSet,
      highlightedTransitionIdSet,
      nodeMap,
      shouldDimByPath,
      selectedEdgeId,
      selectedNodeId,
      selectedEdgeNodeSet,
      hasSelectionFocus,
      isPathFinding,
      densityTuning.strokeScale,
    ],
  );

  const visibleNodeIds = useMemo(() => {
    if (activeNetworkId === null) {
      return new Set(styledNodes.map((node) => node.id));
    }
    return new Set(
      styledNodes
        .filter((node: any) => node?.data?.networkId === activeNetworkId)
        .map((node) => node.id),
    );
  }, [styledNodes, activeNetworkId]);

  const visibleNodes = useMemo(() => {
    if (activeNetworkId === null) {
      return styledNodes;
    }
    return styledNodes.filter((node: any) => node?.data?.networkId === activeNetworkId);
  }, [styledNodes, activeNetworkId]);

  const visibleEdges = useMemo(
    () => styledEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [styledEdges, visibleNodeIds],
  );

  React.useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }

    const previousNetworkId = previousNetworkIdRef.current;
    if (previousNetworkId === activeNetworkId) {
      return;
    }
    previousNetworkIdRef.current = activeNetworkId;

    if (visibleNodes.length === 0) {
      return;
    }

    reactFlowInstance.fitView({
      duration: 620,
      minZoom: 0.02,
      maxZoom: densityTuning.fitMaxZoom,
      padding: densityTuning.canvasPadding,
      nodes: visibleNodes.map((node) => ({ id: node.id })),
    });
  }, [reactFlowInstance, activeNetworkId, visibleNodes, densityTuning.fitMaxZoom, densityTuning.canvasPadding]);

  React.useEffect(() => {
    if (!reactFlowInstance || !focusNodeId) {
      return;
    }

    const targetNode = visibleNodes.find((node) => node.id === focusNodeId);
    if (!targetNode) {
      return;
    }

    reactFlowInstance.fitView({
      duration: 420,
      maxZoom: densityTuning.nodeFocusMaxZoom,
      padding: 1.1,
      nodes: [{ id: focusNodeId }],
    });
  }, [reactFlowInstance, visibleNodes, focusNodeId, focusVersion, densityTuning.nodeFocusMaxZoom]);

  React.useEffect(() => {
    if (!reactFlowInstance || !focusPathNodeIds || focusPathNodeIds.length === 0) {
      return;
    }
    if (pendingRouteFitFrame.current !== null) {
      window.cancelAnimationFrame(pendingRouteFitFrame.current);
      pendingRouteFitFrame.current = null;
    }

    const routeNodeIds = new Set(focusPathNodeIds);
    const routeNodes = visibleNodes.filter((node) => routeNodeIds.has(node.id));
    const validFocusNodes = routeNodes.map((node) => ({ id: node.id }));

    if (validFocusNodes.length === 0) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    routeNodes.forEach((node) => {
      const rect = getNodeRect(node);
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    });

    for (let idx = 0; idx < focusPathNodeIds.length - 1; idx += 1) {
      const sourceId = focusPathNodeIds[idx];
      const targetId = focusPathNodeIds[idx + 1];
      const directedEdges = visibleEdges.filter((edge) => edge.source === sourceId && edge.target === targetId);
      directedEdges.forEach((routeEdge) => {
        const routePoints = Array.isArray(routeEdge?.data?.routePoints) ? routeEdge.data.routePoints : [];
        routePoints.forEach((point: any) => {
          if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
            return;
          }
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
      });
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      pendingRouteFitFrame.current = window.requestAnimationFrame(() => {
        pendingRouteFitFrame.current = window.requestAnimationFrame(() => {
          reactFlowInstance.fitView({
            duration: 760,
            maxZoom: densityTuning.fitMaxZoom,
            padding: Math.max(0.34, densityTuning.routePadding),
            nodes: validFocusNodes,
          });
          pendingRouteFitFrame.current = null;
        });
      });
      return;
    }

    pendingRouteFitFrame.current = window.requestAnimationFrame(() => {
      pendingRouteFitFrame.current = window.requestAnimationFrame(() => {
        reactFlowInstance.fitBounds(
          {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          },
          {
            duration: 760,
            padding: densityTuning.routePadding,
          },
        );
        pendingRouteFitFrame.current = null;
      });
    });

    return () => {
      if (pendingRouteFitFrame.current !== null) {
        window.cancelAnimationFrame(pendingRouteFitFrame.current);
        pendingRouteFitFrame.current = null;
      }
    };
  }, [
    reactFlowInstance,
    visibleNodes,
    visibleEdges,
    focusPathNodeIds,
    focusPathVersion,
    densityTuning.fitMaxZoom,
    densityTuning.routePadding,
  ]);

  return (
    <div className="graph-canvas-wrap">
      <ReactFlow
        className="graph-canvas"
        connectionLineStyle={{ stroke: '#64748b', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'default' }}
        proOptions={{ hideAttribution: true }}
        edgeTypes={edgeTypes}
        edges={visibleEdges}
        fitView
        fitViewOptions={{ padding: densityTuning.canvasPadding, minZoom: 0.02, maxZoom: densityTuning.fitMaxZoom }}
        maxZoom={3.4}
        minZoom={0.02}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        nodes={visibleNodes}
        onInit={setReactFlowInstance}
        onConnect={onConnect}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node)}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
      >
        <Background color="#d4d4d8" gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div
        aria-hidden={!isPathFinding}
        aria-live="polite"
        className={`graph-loading-overlay${isPathFinding ? ' is-active' : ''}`}
        role="status"
      >
        <div className="graph-loading-pill">
          <span className="graph-loading-spinner" />
          Finding route...
        </div>
      </div>
    </div>
  );
};

export default GraphView;
