import React from 'react';
import { Handle, Position } from 'reactflow';

interface CustomNodeProps {
  data: {
    label: string;
    imagePath: string;
    isSelected?: boolean;
    isHighlighted?: boolean;
    isDimmed?: boolean;
  };
}

const CustomNode: React.FC<CustomNodeProps> = ({ data }) => {
  return (
    <div
      className={`custom-node ${data.isSelected ? 'custom-node--selected' : ''} ${data.isHighlighted ? 'custom-node--active' : ''} ${data.isDimmed ? 'custom-node--dimmed' : ''}`}
    >
      <Handle className="node-handle node-handle--top" id="t-in" position={Position.Top} type="target" />
      <Handle className="node-handle node-handle--right" id="r-in" position={Position.Right} type="target" />
      <Handle className="node-handle node-handle--bottom" id="b-in" position={Position.Bottom} type="target" />
      <Handle className="node-handle node-handle--left" id="l-in" position={Position.Left} type="target" />

      <div className="custom-node__media">
        <img alt={data.label} className="custom-node__image" src={data.imagePath} />
      </div>
      <div className="custom-node__title">{data.label}</div>

      <Handle className="node-handle node-handle--top" id="t-out" position={Position.Top} type="source" />
      <Handle className="node-handle node-handle--right" id="r-out" position={Position.Right} type="source" />
      <Handle className="node-handle node-handle--bottom" id="b-out" position={Position.Bottom} type="source" />
      <Handle className="node-handle node-handle--left" id="l-out" position={Position.Left} type="source" />
    </div>
  );
};

export default CustomNode;
