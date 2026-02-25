import React from 'react';
import { graphAPI } from '../api';
import SearchableCombobox from './SearchableCombobox';

interface ActionBarProps {
  onRefresh: () => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onFocusScreen: (query: string) => void;
  screenIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

// SVG Icons as React components
const UndoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3l3-2.3" />
  </svg>
);

const ExportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 11a8 8 0 10-2.34 5.66" />
    <path d="M20 7v4h-4" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const ActionBar: React.FC<ActionBarProps> = ({
  onRefresh,
  onUndo,
  onRedo,
  onFocusScreen,
  screenIds,
  canUndo,
  canRedo,
  onNotify,
}) => {
  const [searchValue, setSearchValue] = React.useState('');
  const sortedScreenIds = React.useMemo(() => [...screenIds].sort((a, b) => a.localeCompare(b)), [screenIds]);

  const handleExportGraph = async () => {
    try {
      const data = await graphAPI.exportGraph();
      const payload = JSON.stringify(data, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `graph_${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      onNotify('success', 'Graph exported successfully.');
    } catch {
      onNotify('error', 'Unable to export graph.');
    }
  };

  return (
    <header className="action-bar">
      <div className="action-bar__group">
        <button
          aria-label="Undo"
          className="btn btn-secondary btn-icon"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          type="button"
        >
          <UndoIcon />
        </button>
        <button
          aria-label="Redo"
          className="btn btn-secondary btn-icon"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Y)"
          type="button"
        >
          <RedoIcon />
        </button>
        <div className="action-bar__divider"></div>
        <button
          aria-label="Export"
          className="btn btn-main btn-icon"
          onClick={handleExportGraph}
          title="Export graph as JSON"
          type="button"
        >
          <ExportIcon />
        </button>
        <button
          aria-label="Refresh"
          className="btn btn-secondary btn-icon"
          onClick={onRefresh}
          title="Refresh graph"
          type="button"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="action-bar__divider"></div>

      <form
        className="action-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (!searchValue.trim()) {
            onNotify('info', 'Please choose a screen first.');
            return;
          }
          onFocusScreen(searchValue);
        }}
      >
        <SearchIcon />
        <SearchableCombobox
          className="action-search__select"
          emptyText="No screen found"
          options={sortedScreenIds}
          onChange={setSearchValue}
          placeholder="Jump to screen..."
          value={searchValue}
        />
        <button className="btn btn-main" type="submit">
          Go
        </button>
      </form>
    </header>
  );
};

export default ActionBar;
