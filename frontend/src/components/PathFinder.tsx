import React, { useEffect, useMemo, useState } from 'react';
import { GraphStatsDto, pathAPI } from '../api';
import SearchableCombobox from './SearchableCombobox';

interface PathOption {
  id: string;
  label: string;
  path: string[];
  transitionIds: string[];
  routeMode: 'simple' | 'shortest';
  totalWeight?: number;
}

interface PathFinderProps {
  screens: string[];
  stats: GraphStatsDto;
  networkCount: number;
  networkOptions: number[];
  selectedNetworkId: 'all' | number;
  onSelectNetwork: (networkId: 'all' | number) => void;
  onPathFound: (paths: string[][]) => void;
  onPathTransitionsFound: (transitionIds: string[]) => void;
  onPathRouteClick: (path: string[]) => void;
  onPathStepClick: (screenId: string) => void;
  onFindingChange: (isFinding: boolean) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const toPathOption = (item: any, label: string, id: string, routeMode: 'simple' | 'shortest'): PathOption | null => {
  if (!item || !Array.isArray(item.path) || item.path.length === 0) {
    return null;
  }
  const transitionIds = Array.isArray(item.transitions)
    ? item.transitions
        .map((transition: any) => transition?.transition_id)
        .filter((transitionId: unknown): transitionId is string => typeof transitionId === 'string' && transitionId.length > 0)
    : [];
  return {
    id,
    label,
    path: item.path,
    transitionIds,
    routeMode,
    totalWeight: typeof item.total_weight === 'number' ? item.total_weight : undefined,
  };
};

const buildRouteOptions = (mode: 'simple' | 'shortest', apiResult: any): PathOption[] => {
  const items = Array.isArray(apiResult?.paths) ? apiResult.paths : [];

  if (mode === 'simple') {
    return items
      .map((item: any, idx: number) => toPathOption(item, `Route ${idx + 1}`, `simple-${idx}`, 'simple'))
      .filter((item: PathOption | null): item is PathOption => item !== null);
  }

  const shortestRaw = items[0];
  const shortest = toPathOption(shortestRaw, 'Shortest', 'shortest-0', 'shortest');
  return shortest ? [shortest] : [];
};

const resolveScreenId = (value: string, screens: string[]): string | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const exact = screens.find((screen) => screen.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }

  const startsWithMatches = screens.filter((screen) => screen.toLowerCase().startsWith(normalized));
  if (startsWithMatches.length === 1) {
    return startsWithMatches[0];
  }
  if (startsWithMatches.length > 1) {
    return null;
  }

  const includesMatches = screens.filter((screen) => screen.toLowerCase().includes(normalized));
  if (includesMatches.length === 1) {
    return includesMatches[0];
  }

  return null;
};

const PathFinder: React.FC<PathFinderProps> = ({
  screens,
  stats,
  networkCount,
  networkOptions,
  selectedNetworkId,
  onSelectNetwork,
  onPathFound,
  onPathTransitionsFound,
  onPathRouteClick,
  onPathStepClick,
  onFindingChange,
  onNotify,
}) => {
  const [fromScreen, setFromScreen] = useState('');
  const [toScreen, setToScreen] = useState('');
  const [loadingMode, setLoadingMode] = useState<'simple' | 'shortest' | null>(null);
  const [options, setOptions] = useState<PathOption[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);

  const activeOption = useMemo(
    () => options.find((option) => option.id === activeOptionId) || null,
    [options, activeOptionId],
  );
  const sortedScreens = useMemo(() => [...screens].sort((a, b) => a.localeCompare(b)), [screens]);

  useEffect(() => () => onFindingChange(false), [onFindingChange]);

  const clearResult = () => {
    setOptions([]);
    setActiveOptionId(null);
    onPathFound([]);
    onPathTransitionsFound([]);
  };
  const handleSwapScreens = () => {
    setFromScreen(toScreen);
    setToScreen(fromScreen);
    clearResult();
  };

  const applyOption = (option: PathOption) => {
    setActiveOptionId(option.id);
    onPathFound([option.path]);
    onPathTransitionsFound(option.transitionIds);
    onPathRouteClick(option.path);
  };

  const runSearch = async (mode: 'simple' | 'shortest') => {
    const resolvedFrom = resolveScreenId(fromScreen, screens);
    const resolvedTo = resolveScreenId(toScreen, screens);

    if (!resolvedFrom || !resolvedTo) {
      onNotify('error', 'Please choose both start and destination screens.');
      return;
    }

    setOptions([]);
    setActiveOptionId(null);
    onPathFound([]);
    onPathTransitionsFound([]);
    onFindingChange(true);
    setLoadingMode(mode);

    try {
      const apiResult =
        mode === 'shortest'
          ? await pathAPI.findShortestPath(resolvedFrom, resolvedTo)
          : await pathAPI.findSimplePath(resolvedFrom, resolvedTo);

      const nextOptions = buildRouteOptions(mode, apiResult);

      if (nextOptions.length === 0) {
        onNotify('error', 'No valid path was found.');
        return;
      }

      const firstOption = nextOptions[0];
      setOptions(nextOptions);
      setActiveOptionId(firstOption.id);
      onPathFound([firstOption.path]);
      onPathTransitionsFound(firstOption.transitionIds);
      onPathRouteClick(firstOption.path);
      onNotify('success', `${mode} found ${nextOptions.length} route(s).`);
    } catch (error: any) {
      onNotify('error', error?.response?.data?.detail || 'No valid path was found.');
    } finally {
      setLoadingMode(null);
      onFindingChange(false);
    }
  };

  return (
    <section className="panel-card panel-card--pathfinder animate-rise">
      <div className="pathfinder-header">
        <h3>Path Finder</h3>
      </div>

      <div className="pathfinder-stats" role="status">
        <span>
          <strong>{stats.num_screens}</strong> Screens
        </span>
        <span>
          <strong>{stats.num_transitions}</strong> Transitions
        </span>
        <span>
          <strong>Network:</strong>{' '}
          {selectedNetworkId === 'all' ? `All (${networkCount})` : `${selectedNetworkId + 1}/${networkCount}`}
        </span>
      </div>
      {networkCount > 1 && (
        <div>
          <label className="field-label" htmlFor="network-filter">
            Network View
          </label>
          <select
            className="field-input"
            id="network-filter"
            onChange={(event) => {
              const value = event.target.value;
              onSelectNetwork(value === 'all' ? 'all' : Number(value));
            }}
            value={selectedNetworkId === 'all' ? 'all' : String(selectedNetworkId)}
          >
            <option value="all">All networks</option>
            {networkOptions.map((networkId) => (
              <option key={networkId} value={String(networkId)}>
                Network {networkId + 1}
              </option>
            ))}
          </select>
        </div>
      )}
      {networkCount > 1 && (
        <div className="pathfinder-warning" role="alert">
          Warning: detected
          {' '}
          <strong>{networkCount}</strong>
          {' '}
          disconnected networks. Expected exactly 1 connected network.
        </div>
      )}

      <div className="pathfinder-grid">
        <div>
          <label className="field-label" htmlFor="path-from">
            From Screen
          </label>
          <SearchableCombobox
            id="path-from"
            options={sortedScreens}
            onChange={setFromScreen}
            placeholder="Type to filter start screen..."
            value={fromScreen}
          />
        </div>

        <div className="pathfinder-swap-wrap">
          <button
            aria-label="Swap from and to screens"
            className="btn btn-secondary pathfinder-swap-btn"
            disabled={loadingMode !== null}
            onClick={handleSwapScreens}
            type="button"
            title="Swap from/to"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 7h12" />
              <path d="m15 3 4 4-4 4" />
              <path d="M17 17H5" />
              <path d="m9 21-4-4 4-4" />
            </svg>
          </button>
        </div>

        <div>
          <label className="field-label" htmlFor="path-to">
            To Screen
          </label>
          <SearchableCombobox
            id="path-to"
            options={sortedScreens}
            onChange={setToScreen}
            placeholder="Type to filter destination screen..."
            value={toScreen}
          />
        </div>
      </div>

      <div className="panel-actions">
        <button
          className="btn btn-main"
          disabled={loadingMode !== null || !fromScreen || !toScreen}
          onClick={() => runSearch('shortest')}
          type="button"
        >
          {loadingMode === 'shortest' ? 'Searching...' : 'Shortest'}
        </button>
        <button
          className="btn btn-secondary"
          disabled={loadingMode !== null || !fromScreen || !toScreen}
          onClick={() => runSearch('simple')}
          type="button"
        >
          {loadingMode === 'simple' ? 'Searching...' : 'Simple'}
        </button>
        <button className="btn btn-danger" onClick={clearResult} type="button">
          Clear
        </button>
      </div>

      {options.length > 0 && (
        <div className="path-result" style={{ backgroundColor: '#dcfce7', borderColor: '#86efac' }}>
          <div className="path-result-steps">
            {options.map((option) => (
              <button
                className={`btn ${activeOptionId === option.id ? 'btn-main' : 'btn-secondary'} path-step-btn`}
                key={option.id}
                onClick={() => applyOption(option)}
                type="button"
              >
                {option.label}
                {' '}
                ({option.path.length})
              </button>
            ))}
          </div>

          {activeOption && (
            <>
              <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>
                {activeOption.label} ({activeOption.path.length} steps)
              </div>
              <div className="route-steps" style={{ marginTop: '0.35rem' }}>
                {activeOption.path.map((screen, idx) => (
                  <button
                    className="route-step-chip"
                    key={`${screen}-${idx}`}
                    onClick={() => {
                      onPathFound([activeOption.path]);
                      onPathTransitionsFound(activeOption.transitionIds);
                      onPathStepClick(screen);
                    }}
                    type="button"
                  >
                    <span className="route-step-index">{idx + 1}</span>
                    <span className="route-step-name">{screen}</span>
                  </button>
                ))}
              </div>
              {typeof activeOption.totalWeight === 'number' && (
                <p style={{ margin: '0.45rem 0 0 0', fontSize: '0.74rem', color: '#15803d' }}>
                  weight: {activeOption.totalWeight}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default PathFinder;
