import {BaseEdge, type Edge, type EdgeProps} from '@xyflow/react';
import type {ReactElement} from 'react';

export interface RequirementEdgeData extends Record<string, unknown> {
    waypoints?: {x: number; y: number}[]; // the lanes the requirement passes, bottom to top
}

export type RequirementEdgeType = Edge<RequirementEdgeData, 'requirement'>;

/**
 * The SVG path through `points`: a straight line along a vertical lane, and an S-curve with vertical tangents between
 * two points at different x, so the requirement leaves and enters each node vertically.
 */
export function requirementPath(points: {x: number; y: number}[]): string {
    const [first, ...rest] = points;
    if (!first) return '';
    let path = `M ${first.x} ${first.y}`;
    let previous = first;
    for (const point of rest) {
        if (Math.abs(point.x - previous.x) < 0.5) {
            path += ` L ${point.x} ${point.y}`;
        } else {
            const middle = (previous.y + point.y) / 2;
            path += ` C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
        }
        previous = point;
    }
    return path;
}

/** A DMN information requirement: from the top of the required element to the bottom of the requiring one. */
export function RequirementEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    markerEnd,
    style,
}: EdgeProps<RequirementEdgeType>): ReactElement {
    const points = [{x: sourceX, y: sourceY}, ...(data?.waypoints ?? []), {x: targetX, y: targetY}];
    return <BaseEdge id={id} path={requirementPath(points)} markerEnd={markerEnd} style={style} />;
}

export const DRD_EDGE_TYPES = {requirement: RequirementEdge};
