import React, { useMemo, useState } from 'react';
import { GraphStatsDto, pathAPI } from '../api';
import SearchableCombobox from './SearchableCombobox';

interface PathOption {
  id: string;
  label: string;
  path: string[];
  totalWeight?: number;
}

interface PathFinderProps {
  screens: string[];
  stats: GraphStatsDto;
  onPathFound: (paths: string[][]) => void;
  onPathRouteClick: (path: string[]) => void;
  onPathStepClick: (screenId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const toPathOption = (item: any, label: string, id: string): PathOption | null => {
  if (!item || !Array.isArray(item.path) || item.path.length === 0) {
    return null;
  }
  return {
    id,
    label,
    path: item.path,
    totalWeight: typeof item.total_weight === 'number' ? item.total_weight : undefined,
  };
};

const buildRouteOptions = (mode: 'simple' | 'shortest', apiResult: any): PathOption[] => {
  if (mode === 'simple') {
    const items = Array.isArray(apiResult?.paths) ? apiResult.paths : [];
    const normalizedItems =
      items.length > 0
        ? items
        : [
            {
              path: Array.isArray(apiResult?.path) ? apiResult.path : [],
              total_weight: apiResult?.total_weight,
            },
          ];

    return normalizedItems
      .map((item: any, idx: number) => toPathOption(item, `Route ${idx + 1}`, `simple-${idx}`))
      .filter((item: PathOption | null): item is PathOption => item !== null);
  }

  const shortestRaw =
    Array.isArray(apiResult?.paths) && apiResult.paths.length > 0
      ? apiResult.paths[0]
      : {
          path: Array.isArray(apiResult?.path) ? apiResult.path : [],
          total_weight: apiResult?.total_weight,
        };
  const shortest = toPathOption(shortestRaw, 'Shortest', 'shortest-0');
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
  onPathFound,
  onPathRouteClick,
  onPathStepClick,
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

  const clearResult = () => {
    setOptions([]);
    setActiveOptionId(null);
    onPathFound([]);
  };

  const applyOption = (option: PathOption) => {
    setActiveOptionId(option.id);
    onPathFound([option.path]);
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
      onPathRouteClick(firstOption.path);
      onNotify('success', `${mode} found ${nextOptions.length} route(s).`);
    } catch (error: any) {
      onNotify('error', error?.response?.data?.detail || 'No valid path was found.');
    } finally {
      setLoadingMode(null);
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
          <strong>D:</strong> {stats.density.toFixed(2)}
        </span>
      </div>

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
              <div className="path-result-steps" style={{ marginTop: '0.3rem' }}>
                {activeOption.path.map((screen, idx) => (
                  <React.Fragment key={`${screen}-${idx}`}>
                    <button
                      className="btn btn-secondary path-step-btn"
                      onClick={() => {
                        onPathFound([activeOption.path]);
                        onPathStepClick(screen);
                      }}
                      type="button"
                    >
                      {screen}
                    </button>
                    {idx < activeOption.path.length - 1 && <span style={{ margin: '0 0.15rem', opacity: 0.6 }}>{'->'}</span>}
                  </React.Fragment>
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
