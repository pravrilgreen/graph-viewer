import React from 'react';
import { Node } from 'reactflow';

interface NodeEditorProps {
  node: Node;
  onClose: () => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, onClose }) => (
  <section className="panel-card animate-rise">
    <div className="panel-head">
      <h3>Screen Details</h3>
      <button 
        className="btn-close" 
        onClick={onClose} 
        type="button"
        aria-label="Close panel"
      >
        ✕
      </button>
    </div>

    <div className="field-meta-list">
      <div>
        <label className="field-label">Screen ID</label>
        <p className="field-meta">{node.id}</p>
      </div>
      
      {node.data?.imagePath && (
        <div>
          <label className="field-label">Image Path</label>
          <p className="field-meta">{node.data.imagePath}</p>
        </div>
      )}

      {node.data?.description && (
        <div>
          <label className="field-label">Description</label>
          <p className="field-meta">{node.data.description}</p>
        </div>
      )}
    </div>
  </section>
);

export default NodeEditor;
