import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';

type XYPoint = { x: number; y: number };

const hashString = (value: string) => {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(idx);
    hash |= 0;
  }
  return Math.abs(hash);
};

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

  const midIndex = Math.floor((polyPoints.length - 1) / 2);
  const nextIndex = Math.min(polyPoints.length - 1, midIndex + 1);
  const basePoint = polyPoints[midIndex];
  const neighborPoint = polyPoints[nextIndex] || basePoint;
  const segDx = neighborPoint.x - basePoint.x;
  const segDy = neighborPoint.y - basePoint.y;
  const segLength = Math.max(Math.hypot(segDx, segDy), 1);
  const normalX = -segDy / segLength;
  const normalY = segDx / segLength;
  const labelX = (basePoint.x + neighborPoint.x) / 2;
  const labelY = (basePoint.y + neighborPoint.y) / 2;

  const hashBase = `${data?.from_screen || ''}-${data?.to_screen || ''}-${data?.action_type || ''}`;
  const offsetBucket = (hashString(hashBase) % 3) - 1;
  const labelOffset = hasRoutePoints ? offsetBucket * 6 : offsetBucket * 3;
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
              transform: `translate(-50%, -50%) translate(${labelX + normalX * labelOffset}px, ${labelY + normalY * labelOffset}px)`,
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
