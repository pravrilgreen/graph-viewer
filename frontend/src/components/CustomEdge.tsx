import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';

type XYPoint = { x: number; y: number };

const CustomEdge: React.FC<EdgeProps> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}) => {
  const isHighlighted = Boolean(data?.isHighlighted);
  const isSelected = Boolean(data?.isSelected);
  const isDimmed = Boolean(data?.isDimmed);
  const flowDuration = isSelected ? '0.65s' : isHighlighted ? '0.8s' : '1.25s';

  const routePoints: XYPoint[] = Array.isArray(data?.routePoints) ? data.routePoints : [];
  const hasRoutePoints = routePoints.length >= 2;

  const polyPoints = hasRoutePoints
    ? routePoints
    : [
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      ];

  const edgePath = polyPoints
    .map((point: XYPoint, idx: number) => `${idx === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;
  const segments: Array<{ start: XYPoint; end: XYPoint; length: number }> = [];
  let totalLength = 0;

  for (let idx = 0; idx < polyPoints.length - 1; idx += 1) {
    const start = polyPoints[idx];
    const end = polyPoints[idx + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= 0.001) {
      continue;
    }
    segments.push({ start, end, length });
    totalLength += length;
  }

  if (segments.length > 0 && totalLength > 0) {
    const halfLength = totalLength / 2;
    let walked = 0;

    for (let idx = 0; idx < segments.length; idx += 1) {
      const segment = segments[idx];
      if (walked + segment.length >= halfLength) {
        const remain = halfLength - walked;
        const ratio = remain / segment.length;
        labelX = segment.start.x + (segment.end.x - segment.start.x) * ratio;
        labelY = segment.start.y + (segment.end.y - segment.start.y) * ratio;
        break;
      }
      walked += segment.length;
    }
  }

  const labelText = `${data?.action_type || ''}`;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          filter: isSelected ? 'drop-shadow(0 0 5px rgba(245, 158, 11, 0.7))' : 'none',
          strokeDasharray: isHighlighted || isSelected ? '10 5' : '8 6',
          animation: `edgeFlow ${flowDuration} linear infinite`,
        }}
      />
      {data?.action_type && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label ${isSelected ? 'edge-label--selected' : ''} ${isDimmed ? 'edge-label--dimmed' : ''}`}
            onClick={() => data?.onEdgeLabelClick?.()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                data?.onEdgeLabelClick?.();
              }
            }}
            role="button"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              transformOrigin: 'center center',
            }}
            tabIndex={0}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
