import React, { useMemo, useState } from 'react';
import { Edge } from 'reactflow';
import { transitionAPI } from '../api';

interface EdgeEditorProps {
  edge: Edge;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface TransitionFormData {
  action_type: string;
  description: string;
  weight: number;
  conditionIds: string[];
  actionParams: Record<string, string>;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const EdgeEditor: React.FC<EdgeEditorProps> = ({ edge, onClose, onSaved, onNotify }) => {
  const defaults = useMemo<TransitionFormData>(
    () => ({
      action_type: edge.data?.action_type || 'click',
      description: edge.data?.description || '',
      weight: Number(edge.data?.weight ?? 1),
      conditionIds: Array.isArray(edge.data?.conditionIds) ? edge.data.conditionIds : [],
      actionParams:
        edge.data?.actionParams && typeof edge.data.actionParams === 'object' && !Array.isArray(edge.data.actionParams)
          ? edge.data.actionParams
          : {},
    }),
    [edge.data],
  );

  const [formData, setFormData] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [actionExpanded, setActionExpanded] = useState(true);
  const [conditionExpanded, setConditionExpanded] = useState(true);

  const save = async () => {
    if (!formData.description.trim()) {
      onNotify('error', 'Description cannot be empty.');
      return;
    }

    const weight = Number(formData.weight);
    if (!Number.isFinite(weight) || weight < 1) {
      onNotify('error', 'Weight must be a number greater than or equal to 1.');
      return;
    }

    try {
      setLoading(true);
      await transitionAPI.updateTransition({
        from_screen: edge.source,
        to_screen: edge.target,
        action: {
          type: formData.action_type,
          description: formData.description.trim(),
          params: formData.actionParams,
        },
        weight,
        conditionIds: formData.conditionIds,
      });
      await onSaved();
      onNotify('success', `Transition ${edge.source} → ${edge.target} updated.`);
      onClose();
    } catch (error: any) {
      onNotify('error', error?.response?.data?.detail || 'Unable to update transition.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel-card animate-rise">
      <div className="panel-head">
        <h3>Edit Transition</h3>
        <button 
          className="btn-close" 
          onClick={onClose} 
          type="button"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="field-meta">
        <strong>{edge.source}</strong> <span style={{ opacity: 0.5, margin: '0 0.25rem' }}>→</span> <strong>{edge.target}</strong>
      </div>

      {/* Action Section */}
      <div style={{ marginTop: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setActionExpanded((prev) => !prev)}
          type="button"
          aria-expanded={actionExpanded}
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <span>Action Settings</span>
          <ChevronIcon expanded={actionExpanded} />
        </button>

        {actionExpanded && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="field-label" htmlFor="action-type">
                Action Type
              </label>
              <select
                className="field-input"
                id="action-type"
                onChange={(event) => setFormData((prev) => ({ ...prev, action_type: event.target.value }))}
                value={formData.action_type}
              >
                <option value="click">click</option>
                <option value="swipe">swipe</option>
                <option value="hardware_button">hardware_button</option>
                <option value="auto">auto</option>
                <option value="condition">condition</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="description">
                Action Description
              </label>
              <textarea
                className="field-input"
                id="description"
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                value={formData.description}
                placeholder="Describe the action..."
              />
            </div>

            <div>
              <label className="field-label" htmlFor="weight">
                Weight (Priority)
              </label>
              <input
                className="field-input"
                id="weight"
                min={1}
                onChange={(event) => setFormData((prev) => ({ ...prev, weight: Number(event.target.value || 1) }))}
                type="number"
                value={formData.weight}
              />
              <p className="field-meta" style={{ marginTop: '0.25rem' }}>
                Higher weight means higher priority
              </p>
            </div>

            {Object.keys(formData.actionParams).length > 0 && (
              <div>
                <label className="field-label">Action Parameters</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(formData.actionParams).map(([paramKey, paramValue]) => (
                    <div key={paramKey}>
                      <label className="field-label" htmlFor={`param-${paramKey}`}>
                        {paramKey}
                      </label>
                      <input
                        className="field-input"
                        id={`param-${paramKey}`}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            actionParams: {
                              ...prev.actionParams,
                              [paramKey]: event.target.value,
                            },
                          }))
                        }
                        value={paramValue}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Condition Section */}
      <div style={{ marginTop: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setConditionExpanded((prev) => !prev)}
          type="button"
          aria-expanded={conditionExpanded}
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <span>Conditions {formData.conditionIds.length > 0 && `(${formData.conditionIds.length})`}</span>
          <ChevronIcon expanded={conditionExpanded} />
        </button>

        {conditionExpanded && (
          <div style={{ marginTop: '0.75rem' }}>
            {formData.conditionIds.length > 0 ? (
              <ul className="id-listview">
                {formData.conditionIds.map((conditionId) => (
                  <li className="id-listview__item" key={conditionId}>
                    <code style={{ fontSize: '0.8rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {conditionId}
                    </code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-meta" style={{ textAlign: 'center', padding: '0.75rem 0', opacity: 0.6 }}>
                No conditions attached
              </p>
            )}
          </div>
        )}
      </div>

      <div className="panel-actions" style={{ marginTop: '1rem' }}>
        <button 
          className="btn btn-main" 
          disabled={loading} 
          onClick={save} 
          type="button"
          style={{ flex: 1 }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button 
          className="btn btn-secondary" 
          disabled={loading}
          onClick={onClose} 
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  );
};

export default EdgeEditor;
