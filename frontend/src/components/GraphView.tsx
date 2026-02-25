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
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  highlightedPaths?: string[][];
}

const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes = { default: CustomEdge };

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
  selectedNodeId,
  selectedEdgeId,
  highlightedPaths = [],
}) => {
  const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const normalizedHighlightedPaths = useMemo(
    () => highlightedPaths.filter((path) => Array.isArray(path) && path.length > 1),
    [highlightedPaths],
  );
  const hasActivePath = normalizedHighlightedPaths.length > 0;
  const hasSelectionFocus = Boolean(selectedNodeId || selectedEdgeId);
  const shouldDimByPath = hasActivePath && !hasSelectionFocus;

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
          opacity:
            (shouldDimByPath && !pathNodeSet.has(node.id)) ||
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
    ],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const isPathHighlighted = pathEdgeSet.has(`${edge.source}->${edge.target}`);
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

        const { sourcePosition, targetPosition } = getClosestPositions(
          nodeMap.get(edge.source),
          nodeMap.get(edge.target),
        );

        return {
          ...edge,
          interactionWidth: 28,
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
            stroke: isSelected ? '#f59e0b' : isHighlighted ? '#2563eb' : '#94a3b8',
            strokeWidth: isSelected ? 3.2 : isHighlighted ? 2.8 : 2,
            opacity: (shouldDimByPath || hasSelectionFocus) && !isHighlighted && !isSelected ? 0.16 : 1,
          },
        };
      }),
    [
      edges,
      pathEdgeSet,
      nodeMap,
      shouldDimByPath,
      selectedEdgeId,
      selectedNodeId,
      selectedEdgeNodeSet,
      hasSelectionFocus,
    ],
  );

  React.useEffect(() => {
    if (!reactFlowInstance || !focusNodeId) {
      return;
    }

    const targetNode = nodes.find((node) => node.id === focusNodeId);
    if (!targetNode) {
      return;
    }

    reactFlowInstance.fitView({
      duration: 420,
      maxZoom: 2.2,
      padding: 1.1,
      nodes: [{ id: focusNodeId }],
    });
  }, [reactFlowInstance, nodes, focusNodeId, focusVersion]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        className="graph-canvas"
        connectionLineStyle={{ stroke: '#64748b', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'default' }}
        edgeTypes={edgeTypes}
        edges={styledEdges}
        fitView
        fitViewOptions={{ padding: 0.22, minZoom: 0.02, maxZoom: 1.8 }}
        maxZoom={3.4}
        minZoom={0.02}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        nodes={styledNodes}
        onInit={setReactFlowInstance}
        onConnect={onConnect}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node)}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
      >
        <Background color="#d4d4d8" gap={24} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default GraphView;
