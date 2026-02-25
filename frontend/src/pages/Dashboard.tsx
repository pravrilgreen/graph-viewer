import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, Edge, Node, useEdgesState, useNodesState } from 'reactflow';

import { GraphStatsDto, ScreenDto, graphAPI, screenAPI, transitionAPI } from '../api';
import ActionBar from '../components/ActionBar';
import EdgeEditor from '../components/EdgeEditor';
import GraphView from '../components/GraphView';
import NodeEditor from '../components/NodeEditor';
import PathFinder from '../components/PathFinder';
import ToastStack, { ToastMessage, ToastType } from '../components/ToastStack';
import { buildGraphModel } from '../graph/graphBuilder';
import { buildGraphLayout } from '../graph/graphLayout';

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  screens: ScreenDto[];
}

const defaultStats: GraphStatsDto = {
  num_screens: 0,
  num_transitions: 0,
  density: 0,
};

const Dashboard: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [screens, setScreens] = useState<ScreenDto[]>([]);
  const [highlightedPaths, setHighlightedPaths] = useState<string[][]>([]);

  const [history, setHistory] = useState<GraphState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
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

  const loadGraph = useCallback(
    async (keepHistory = false) => {
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

        if (keepHistory) {
          setHistory((prev) => {
            const trimmed = prev.slice(0, historyIndex + 1);
            trimmed.push({ nodes: graphNodes, edges: graphEdges, screens: screensData });
            return trimmed;
          });
          setHistoryIndex((prev) => prev + 1);
        } else {
          setHistory([{ nodes: graphNodes, edges: graphEdges, screens: screensData }]);
          setHistoryIndex(0);
        }
      } catch (error: any) {
        pushToast('error', error?.response?.data?.detail || 'Unable to load graph data.');
      }
    },
    [historyIndex, pushToast, setEdges, setNodes],
  );

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }
    const prevIndex = historyIndex - 1;
    const prevState = history[prevIndex];
    setHistoryIndex(prevIndex);
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setScreens(prevState.screens);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }
    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    setHistoryIndex(nextIndex);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setScreens(nextState.screens);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleUndo]);

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
    setHighlightedPaths([path]);
  };

  const handleSearchPathFound = useCallback((paths: string[][]) => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setFocusNodeId(null);
    setHighlightedPaths(paths);
  }, []);

  const handlePathStepPreview = useCallback(
    (screenId: string) => {
      const targetNode = nodes.find((node) => node.id === screenId);
      if (!targetNode) {
        pushToast('error', `Screen "${screenId}" is not available in current layout.`);
        return;
      }
      // Pan/zoom only. Keep search highlight and avoid changing selection focus state.
      setFocusNodeId(screenId);
      setFocusVersion((prev) => prev + 1);
    },
    [nodes, pushToast],
  );

  const activePanel = useMemo(() => {
    if (selectedNode) {
      return (
        <>
          <PathFinder
            onNotify={pushToast}
            onPathFound={handleSearchPathFound}
            onPathRouteClick={handleFocusPathRoute}
            onPathStepClick={handlePathStepPreview}
            screens={screens.map((screen) => screen.screen_id)}
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
            onNotify={pushToast}
            onPathFound={handleSearchPathFound}
            onPathRouteClick={handleFocusPathRoute}
            onPathStepClick={handlePathStepPreview}
            screens={screens.map((screen) => screen.screen_id)}
            stats={stats}
          />
          <EdgeEditor
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
            onNotify={pushToast}
            onSaved={async () => {
              await loadGraph(true);
            }}
          />
        </>
      );
    }

    return (
      <>
        <PathFinder
          onNotify={pushToast}
          onPathFound={handleSearchPathFound}
          onPathRouteClick={handleFocusPathRoute}
          onPathStepClick={handlePathStepPreview}
          screens={screens.map((screen) => screen.screen_id)}
          stats={stats}
        />
      </>
    );
  }, [handlePathStepPreview, handleSearchPathFound, loadGraph, pushToast, screens, selectedEdge, selectedNode, stats]);

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

      <section className="top-row">
        <ActionBar
          canRedo={historyIndex < history.length - 1}
          canUndo={historyIndex > 0}
          onFocusScreen={handleFocusScreen}
          onNotify={pushToast}
          onRedo={handleRedo}
          onRefresh={() => loadGraph(true)}
          screenIds={screens.map((screen) => screen.screen_id)}
          onUndo={handleUndo}
        />
      </section>

      <div className="layout-grid">
        <section className="graph-panel">
          <GraphView
            edges={edges}
            highlightedPaths={highlightedPaths}
            nodes={nodes}
            onConnect={onConnect}
            onEdgeClick={(edge) => {
              setHighlightedPaths([]);
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
            onEdgesChange={onEdgesChange}
            onNodeClick={(node) => {
              setHighlightedPaths([]);
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onNodesChange={onNodesChange}
            onPaneClick={() => {
              setHighlightedPaths([]);
              setSelectedEdge(null);
              setSelectedNode(null);
            }}
            focusNodeId={focusNodeId}
            focusVersion={focusVersion}
            selectedEdgeId={selectedEdge?.id || null}
            selectedNodeId={selectedNode?.id || null}
          />
        </section>

        <aside className="side-panel">{activePanel}</aside>
      </div>
    </main>
  );
};

export default Dashboard;
