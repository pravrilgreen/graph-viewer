import React, { useState } from 'react';
import { screenAPI, transitionAPI } from '../api';

interface QuickCreatePanelProps {
  screens: string[];
  onChanged: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const initialTransition = {
  from_screen: '',
  to_screen: '',
  action_type: 'click',
  description: '',
  weight: 1,
  conditionIds: '',
  actionParams: '{}',
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const QuickCreatePanel: React.FC<QuickCreatePanelProps> = ({ screens, onChanged, onNotify }) => {
  const [newScreenId, setNewScreenId] = useState('');
  const [transition, setTransition] = useState(initialTransition);
  const [loading, setLoading] = useState(false);
  const conditionPreview = transition.conditionIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const createScreen = async () => {
    const nextId = newScreenId.trim();
    if (!nextId) {
      onNotify('error', 'Enter a screen ID before creating.');
      return;
    }

    try {
      setLoading(true);
      await screenAPI.createScreen(nextId);
      setNewScreenId('');
      await onChanged();
      onNotify('success', `Screen ${nextId} created.`);
    } catch (error: any) {
      onNotify('error', error?.response?.data?.detail || 'Unable to create screen.');
    } finally {
      setLoading(false);
    }
  };

  const createTransition = async () => {
    if (!transition.from_screen || !transition.to_screen) {
      onNotify('error', 'Select both source and destination screens.');
      return;
    }

    if (!transition.description.trim()) {
      onNotify('error', 'Enter a description for the transition.');
      return;
    }

    try {
      setLoading(true);
      await transitionAPI.createTransition({
        from_screen: transition.from_screen,
        to_screen: transition.to_screen,
        action: {
          type: transition.action_type,
          description: transition.description.trim(),
          params: JSON.parse(transition.actionParams || '{}'),
        },
        weight: Number(transition.weight) || 1,
        conditionIds: transition.conditionIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      });
      setTransition(initialTransition);
      await onChanged();
      onNotify('success', 'Transition created.');
    } catch (error: any) {
      onNotify('error', error?.response?.data?.detail || 'Unable to create transition.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel-card animate-rise">
      <h3>Quick Create</h3>

      {/* Create Screen Section */}
      <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <label className="field-label" htmlFor="new-screen-id">
          New Screen
        </label>
        <div className="inline-actions">
          <input
            className="field-input"
            id="new-screen-id"
            onChange={(event) => setNewScreenId(event.target.value)}
            placeholder="Enter screen ID..."
            value={newScreenId}
          />
          <button 
            className="btn btn-main btn-icon" 
            disabled={loading || !newScreenId.trim()} 
            onClick={createScreen} 
            type="button"
            title="Create new screen"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* Create Transition Section */}
      <div style={{ marginTop: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: 'var(--text-secondary)' }}>
          New Transition
        </h4>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label className="field-label" htmlFor="from-screen">
                From
              </label>
              <select
                className="field-input"
                id="from-screen"
                onChange={(event) => setTransition((prev) => ({ ...prev, from_screen: event.target.value }))}
                value={transition.from_screen}
              >
                <option value="">Select...</option>
                {screens.map((screen) => (
                  <option key={`from-${screen}`} value={screen}>
                    {screen}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="to-screen">
                To
              </label>
              <select
                className="field-input"
                id="to-screen"
                onChange={(event) => setTransition((prev) => ({ ...prev, to_screen: event.target.value }))}
                value={transition.to_screen}
              >
                <option value="">Select...</option>
                {screens.map((screen) => (
                  <option key={`to-${screen}`} value={screen}>
                    {screen}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="transition-action">
              Action Type
            </label>
            <select
              className="field-input"
              id="transition-action"
              onChange={(event) => setTransition((prev) => ({ ...prev, action_type: event.target.value }))}
              value={transition.action_type}
            >
              <option value="click">click</option>
              <option value="swipe">swipe</option>
              <option value="hardware_button">hardware_button</option>
              <option value="auto">auto</option>
              <option value="condition">condition</option>
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="transition-desc">
              Description
            </label>
            <input
              className="field-input"
              id="transition-desc"
              onChange={(event) => setTransition((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="What triggers this transition?"
              value={transition.description}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label className="field-label" htmlFor="transition-weight">
                Weight
              </label>
              <input
                className="field-input"
                id="transition-weight"
                min={1}
                onChange={(event) => setTransition((prev) => ({ ...prev, weight: Number(event.target.value || 1) }))}
                type="number"
                value={transition.weight}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="transition-action-params">
                Action Params
              </label>
              <input
                className="field-input"
                id="transition-action-params"
                onChange={(event) => setTransition((prev) => ({ ...prev, actionParams: event.target.value }))}
                placeholder='{...}'
                value={transition.actionParams}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="transition-condition-ids">
              Condition IDs
            </label>
            <input
              className="field-input"
              id="transition-condition-ids"
              onChange={(event) => setTransition((prev) => ({ ...prev, conditionIds: event.target.value }))}
              placeholder="condA, condB, condC..."
              value={transition.conditionIds}
            />
            {conditionPreview.length > 0 && (
              <ul className="id-listview id-listview--compact" style={{ marginTop: '0.5rem' }}>
                {conditionPreview.map((conditionId, idx) => (
                  <li className="id-listview__item" key={`${conditionId}-${idx}`}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{conditionId}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button 
            className="btn btn-main" 
            disabled={loading || !transition.from_screen || !transition.to_screen} 
            onClick={createTransition} 
            type="button"
            style={{ marginTop: '0.5rem' }}
          >
            <PlusIcon /> Create Transition
          </button>
        </div>
      </div>
    </section>
  );
};

export default QuickCreatePanel;
