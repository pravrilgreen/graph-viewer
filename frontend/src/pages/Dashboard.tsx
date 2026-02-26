import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Connection, Edge, Node, useEdgesState, useNodesState } from 'reactflow';

import { GraphStatsDto, ScreenDto, graphAPI, screenAPI, transitionAPI } from '../api';
import EdgeEditor from '../components/EdgeEditor';
import GraphView from '../components/GraphView';
import NodeEditor from '../components/NodeEditor';
import PathFinder from '../components/PathFinder';
import ToastStack, { ToastMessage, ToastType } from '../components/ToastStack';
import { buildGraphModel } from '../graph/graphBuilder';
import { buildGraphLayout } from '../graph/graphLayout';

const defaultStats: GraphStatsDto = {
  num_screens: 0,
  num_transitions: 0,
  density: 0,
};
const MIN_PATH_FINDING_VISIBLE_MS = 300;

const Dashboard: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [screens, setScreens] = useState<ScreenDto[]>([]);
  const [highlightedPaths, setHighlightedPaths] = useState<string[][]>([]);
  const [highlightedTransitionIds, setHighlightedTransitionIds] = useState<string[]>([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [focusPathNodeIds, setFocusPathNodeIds] = useState<string[] | null>(null);
  const [focusPathVersion, setFocusPathVersion] = useState(0);
  const [isPathFinding, setIsPathFinding] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState<'all' | number>('all');
  const pathFindingStartedAtRef = useRef<number | null>(null);
  const pathFindingHideTimerRef = useRef<number | null>(null);
  const [stats, setStats] = useState<GraphStatsDto>(defaultStats);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: ToastType, text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const loadGraph = useCallback(async () => {
    try {
      const [screensData, transitionsData, statsData] = await Promise.all([
        screenAPI.getAllScreens(),
        transitionAPI.getAllTransitions(),
        graphAPI.getStats(),
      ]);

      const graphModel = buildGraphModel(screensData, transitionsData);
      const { nodes: graphNodes, edges: graphEdges } = await buildGraphLayout(graphModel);

      setScreens(screensData);
      setStats(statsData);
      setNodes(graphNodes);
      setEdges(graphEdges);
    } catch (error: any) {
      pushToast('error', error?.response?.data?.detail || 'Unable to load graph data.');
    }
  }, [pushToast, setEdges, setNodes]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(
    () => () => {
      if (pathFindingHideTimerRef.current !== null) {
        window.clearTimeout(pathFindingHideTimerRef.current);
        pathFindingHideTimerRef.current = null;
      }
    },
    [],
  );

  const onConnect = (_connection: Connection) => {
    pushToast('info', 'Drag-to-connect is disabled.');
  };

  const handleFocusScreen = (query: string, keepPathHighlight = false) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const screenIds = screens.map((screen) => screen.screen_id);
    const exact = screenIds.find((id) => id.toLowerCase() === normalized);
    const startsWith = screenIds.find((id) => id.toLowerCase().startsWith(normalized));
    const includes = screenIds.find((id) => id.toLowerCase().includes(normalized));
    const targetId = exact || startsWith || includes;

    if (!targetId) {
      pushToast('error', `Screen "${query}" was not found.`);
      return;
    }

    const targetNode = nodes.find((node) => node.id === targetId) || null;
    if (!targetNode) {
      pushToast('error', `Screen "${targetId}" is not available in current layout.`);
      return;
    }

    if (!keepPathHighlight) {
      setHighlightedPaths([]);
    }
    setFocusPathNodeIds(null);
    setSelectedEdge(null);
    setSelectedNode(targetNode);
    setFocusNodeId(targetId);
    setFocusVersion((prev) => prev + 1);
  };

  const handleFocusPathRoute = (path: string[]) => {
    if (!Array.isArray(path) || path.length === 0) {
      return;
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    setFocusNodeId(null);
    setFocusPathNodeIds(path);
    setFocusPathVersion((prev) => prev + 1);
  };

  const handleSearchPathFound = useCallback((paths: string[][]) => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setFocusNodeId(null);
    if (paths.length === 0) {
      setFocusPathNodeIds(null);
    }
    setHighlightedPaths(paths);
  }, []);

  const handleSearchPathTransitionsFound = useCallback((transitionIds: string[]) => {
    setHighlightedTransitionIds(transitionIds);
  }, []);

  const handlePathStepPreview = useCallback(
    (screenId: string) => {
      const targetNode = nodes.find((node) => node.id === screenId);
      if (!targetNode) {
        pushToast('error', `Screen "${screenId}" is not available in current layout.`);
        return;
      }
      // Pan/zoom only. Keep search highlight and avoid changing selection focus state.
      setFocusPathNodeIds(null);
      setFocusNodeId(screenId);
      setFocusVersion((prev) => prev + 1);
    },
    [nodes, pushToast],
  );

  const handlePathFindingChange = useCallback((isFinding: boolean) => {
    if (pathFindingHideTimerRef.current !== null) {
      window.clearTimeout(pathFindingHideTimerRef.current);
      pathFindingHideTimerRef.current = null;
    }

    if (isFinding) {
      pathFindingStartedAtRef.current = Date.now();
      setIsPathFinding(true);
      return;
    }

    const startedAt = pathFindingStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_PATH_FINDING_VISIBLE_MS - elapsed);

    if (remaining === 0) {
      setIsPathFinding(false);
      pathFindingStartedAtRef.current = null;
      return;
    }

    pathFindingHideTimerRef.current = window.setTimeout(() => {
      setIsPathFinding(false);
      pathFindingStartedAtRef.current = null;
      pathFindingHideTimerRef.current = null;
    }, remaining);
  }, []);

  const handleSelectNetwork = useCallback((networkId: 'all' | number) => {
    setSelectedNetworkId(networkId);
    setHighlightedPaths([]);
    setHighlightedTransitionIds([]);
    setSelectedNode(null);
    setSelectedEdge(null);
    setFocusNodeId(null);
    setFocusPathNodeIds(null);
  }, []);

  const networkCount = useMemo(() => {
    if (nodes.length === 0) {
      return 0;
    }

    const adjacency = new Map<string, Set<string>>();
    nodes.forEach((node) => adjacency.set(node.id, new Set<string>()));

    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set<string>());
      }
      if (!adjacency.has(edge.target)) {
        adjacency.set(edge.target, new Set<string>());
      }
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    });

    const visited = new Set<string>();
    let components = 0;

    nodes.forEach((node) => {
      if (visited.has(node.id)) {
        return;
      }

      components += 1;
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current) || new Set<string>();
        neighbors.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    });

    return components;
  }, [nodes, edges]);

  const networkOptions = useMemo(() => {
    const unique = new Set<number>();
    nodes.forEach((node: any) => {
      const raw = node?.data?.networkId;
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) {
        unique.add(raw);
      }
    });
    return [...unique].sort((a, b) => a - b);
  }, [nodes]);

  const screenNetworkMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((node: any) => {
      const networkId = node?.data?.networkId;
      if (typeof networkId === 'number') {
        map.set(node.id, networkId);
      }
    });
    return map;
  }, [nodes]);

  const visibleScreenIds = useMemo(() => {
    const allScreenIds = screens.map((screen) => screen.screen_id);
    if (selectedNetworkId === 'all') {
      return allScreenIds;
    }
    return allScreenIds.filter((screenId) => screenNetworkMap.get(screenId) === selectedNetworkId);
  }, [screens, selectedNetworkId, screenNetworkMap]);

  useEffect(() => {
    if (networkCount <= 1) {
      if (selectedNetworkId !== 'all') {
        setSelectedNetworkId('all');
      }
      return;
    }

    if (selectedNetworkId === 'all') {
      return;
    }

    if (!networkOptions.includes(selectedNetworkId)) {
      setSelectedNetworkId(networkOptions[0] ?? 'all');
    }
  }, [networkCount, networkOptions, selectedNetworkId]);

  const activePanel = useMemo(() => {
    if (selectedNode) {
      return (
        <>
          <PathFinder
            networkCount={networkCount}
            networkOptions={networkOptions}
            selectedNetworkId={selectedNetworkId}
            onSelectNetwork={handleSelectNetwork}
            onFindingChange={handlePathFindingChange}
            onNotify={pushToast}
            onPathFound={handleSearchPathFound}
            onPathTransitionsFound={handleSearchPathTransitionsFound}
            onPathRouteClick={handleFocusPathRoute}
            onPathStepClick={handlePathStepPreview}
            screens={visibleScreenIds}
            stats={stats}
          />
          <NodeEditor
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </>
      );
    }

    if (selectedEdge) {
      return (
        <>
          <PathFinder
            networkCount={networkCount}
            networkOptions={networkOptions}
            selectedNetworkId={selectedNetworkId}
            onSelectNetwork={handleSelectNetwork}
            onFindingChange={handlePathFindingChange}
            onNotify={pushToast}
            onPathFound={handleSearchPathFound}
            onPathTransitionsFound={handleSearchPathTransitionsFound}
            onPathRouteClick={handleFocusPathRoute}
            onPathStepClick={handlePathStepPreview}
            screens={visibleScreenIds}
            stats={stats}
          />
          <EdgeEditor
            key={selectedEdge.id}
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
            onNotify={pushToast}
            onSaved={async () => {
              await loadGraph();
            }}
          />
        </>
      );
    }

    return (
      <>
        <PathFinder
          networkCount={networkCount}
          networkOptions={networkOptions}
          selectedNetworkId={selectedNetworkId}
          onSelectNetwork={handleSelectNetwork}
          onFindingChange={handlePathFindingChange}
          onNotify={pushToast}
          onPathFound={handleSearchPathFound}
          onPathTransitionsFound={handleSearchPathTransitionsFound}
          onPathRouteClick={handleFocusPathRoute}
          onPathStepClick={handlePathStepPreview}
          screens={visibleScreenIds}
          stats={stats}
        />
      </>
    );
  }, [
    handlePathFindingChange,
    handleSelectNetwork,
    handlePathStepPreview,
    handleSearchPathFound,
    handleSearchPathTransitionsFound,
    loadGraph,
    pushToast,
    screens,
    visibleScreenIds,
    selectedEdge,
    selectedNode,
    stats,
    networkCount,
    networkOptions,
    selectedNetworkId,
  ]);

  return (
    <main className="app-shell">
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className="app-header">
        <div className="app-header__brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="5" r="1"></circle>
            <circle cx="5" cy="19" r="1"></circle>
            <path d="M12 13v8M12 11V3M5 18v-0.5M19 6v-0.5"></path>
            <path d="M6 18c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM18 6c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"></path>
          </svg>
          <h1 className="app-header__title">Graph Viewer</h1>
        </div>
      </header>

      <div className="layout-grid">
        <section className="graph-panel">
          <GraphView
            edges={edges}
            highlightedPaths={highlightedPaths}
            highlightedTransitionIds={highlightedTransitionIds}
            nodes={nodes}
            onConnect={onConnect}
            onEdgeClick={(edge) => {
              setHighlightedPaths([]);
              setHighlightedTransitionIds([]);
              setFocusNodeId(null);
              setFocusPathNodeIds(null);
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
            onEdgesChange={onEdgesChange}
            onNodeClick={(node) => {
              setHighlightedPaths([]);
              setHighlightedTransitionIds([]);
              setFocusNodeId(null);
              setFocusPathNodeIds(null);
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onNodesChange={onNodesChange}
            onPaneClick={() => {
              setHighlightedPaths([]);
              setHighlightedTransitionIds([]);
              setFocusNodeId(null);
              setFocusPathNodeIds(null);
              setSelectedEdge(null);
              setSelectedNode(null);
            }}
            focusNodeId={focusNodeId}
            focusVersion={focusVersion}
            focusPathNodeIds={focusPathNodeIds}
            focusPathVersion={focusPathVersion}
            isPathFinding={isPathFinding}
            activeNetworkId={selectedNetworkId === 'all' ? null : selectedNetworkId}
            selectedEdgeId={selectedEdge?.id || null}
            selectedNodeId={selectedNode?.id || null}
            searchOptions={visibleScreenIds}
            onFocusScreen={handleFocusScreen}
          />
        </section>

        <aside className="side-panel">{activePanel}</aside>
      </div>
    </main>
  );
};

export default Dashboard;
