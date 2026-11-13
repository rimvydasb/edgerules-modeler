import type {DrdElement, DrdGraph} from './requirementsGraph';

// A layered (Sugiyama-style) layout of the decision requirements graph. DMN draws the requirements upwards: the input
// data at the bottom, each decision one layer above the highest element it requires, the decision services on top. A
// requirement that spans several layers passes each layer in between through a virtual point, so it runs beside the
// nodes of that layer, never through them. Barycenter sweeps order each layer to cross as few edges as possible, and a
// relaxation moves each node towards the elements it is linked to.

export const DRD_NODE_WIDTH = 220;
const DECISION_HEIGHT = 76;
const SERVICE_HEIGHT = 88;
const INPUT_HEIGHT = 56;
const FACTS_HEADER = 26; // the facts tray under an input: its caption and padding
const FACT_ROW = 20;
const VIRTUAL_WIDTH = 14; // the lane of a long requirement in a layer it passes
const GAP_X = 40;
const GAP_Y = 90;
const SWEEPS = 8;
const RELAXATIONS = 12;

/** The height of the node of `element`; an input grows by the facts tray below its stadium shape. */
export function drdNodeHeight(element: DrdElement): number {
    if (element.kind === 'decision') return DECISION_HEIGHT;
    if (element.kind === 'service') return SERVICE_HEIGHT;
    const facts = element.facts?.length ?? 0;
    return INPUT_HEIGHT + (facts > 0 ? FACTS_HEADER + facts * FACT_ROW : 0);
}

export interface DrdLayout {
    positions: Record<string, {x: number; y: number}>; // the top-left position of each element by id
    waypoints: Record<string, {x: number; y: number}[]>; // requirement id -> the points it passes, bottom to top
}

interface Slot {
    id: string;
    width: number;
    element?: DrdElement; // undefined: a virtual point of a long requirement
}

export function layoutDrd(graph: DrdGraph): DrdLayout {
    const byId = new Map(graph.elements.map((element) => [element.id, element]));
    const information = graph.requirements.filter(
        (requirement) =>
            requirement.kind === 'information' && byId.has(requirement.source) && byId.has(requirement.target),
    );
    const required = new Map<string, string[]>(); // target -> sources
    for (const requirement of information) {
        required.set(requirement.target, [...(required.get(requirement.target) ?? []), requirement.source]);
    }

    // The layer of each element: inputs 0, a decision one above what it requires, the services on the top layer.
    const layers = new Map<string, number>();
    const layerOf = (id: string, visiting: Set<string>): number => {
        const known = layers.get(id);
        if (known !== undefined) return known;
        if (byId.get(id)?.kind === 'input') return 0;
        if (visiting.has(id)) return 1; // a requirement cycle does not link; keep the walk finite
        visiting.add(id);
        const layer = Math.max(0, ...(required.get(id) ?? []).map((source) => layerOf(source, visiting))) + 1;
        visiting.delete(id);
        layers.set(id, layer);
        return layer;
    };
    for (const element of graph.elements) layers.set(element.id, layerOf(element.id, new Set()));
    const decisions = graph.elements.filter((element) => element.kind === 'decision');
    const top = Math.max(0, ...decisions.map((element) => layers.get(element.id)!)) + 1;
    for (const element of graph.elements) if (element.kind === 'service') layers.set(element.id, top);

    // The rows of slots, bottom first, and the links between slots of adjacent rows.
    const rows: Slot[][] = [];
    const rowOf = (layer: number) => (rows[layer] ??= []);
    for (const element of graph.elements) {
        rowOf(layers.get(element.id)!).push({id: element.id, width: DRD_NODE_WIDTH, element});
    }
    const below = new Map<string, string[]>(); // slot -> the linked slots of the row below
    const above = new Map<string, string[]>(); // slot -> the linked slots of the row above
    const link = (lower: string, upper: string) => {
        below.set(upper, [...(below.get(upper) ?? []), lower]);
        above.set(lower, [...(above.get(lower) ?? []), upper]);
    };
    const chains = new Map<string, string[]>(); // requirement id -> its virtual slots, bottom to top
    for (const requirement of information) {
        const from = layers.get(requirement.source)!;
        const to = layers.get(requirement.target)!;
        if (to <= from) continue;
        const chain: string[] = [];
        let previous = requirement.source;
        for (let layer = from + 1; layer < to; layer++) {
            const id = `${requirement.id}#${layer}`;
            rowOf(layer).push({id, width: VIRTUAL_WIDTH});
            chain.push(id);
            link(previous, id);
            previous = id;
        }
        link(previous, requirement.target);
        chains.set(requirement.id, chain);
    }
    const filled = Array.from(rows, (row) => row ?? []);

    // Barycenter sweeps: up orders a row by the row below it, down by the row above it.
    const indexOf = new Map<string, number>();
    const reindex = (row: Slot[]) => row.forEach((slot, index) => indexOf.set(slot.id, index));
    filled.forEach(reindex);
    const order = (row: Slot[], neighbours: Map<string, string[]>) => {
        const center = new Map(
            row.map((slot) => {
                const near = (neighbours.get(slot.id) ?? []).map((other) => indexOf.get(other)!);
                return [slot.id, near.length ? near.reduce((a, b) => a + b, 0) / near.length : indexOf.get(slot.id)!];
            }),
        );
        row.sort((a, b) => center.get(a.id)! - center.get(b.id)!);
        reindex(row);
    };
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
        if (sweep % 2 === 0) for (const row of filled.slice(1)) order(row, below);
        else for (const row of filled.slice(0, -1).reverse()) order(row, above);
    }

    // The horizontal centre of each slot: packed rows, then relaxed towards the linked slots in the order of the row.
    const centerX = new Map<string, number>();
    for (const row of filled) {
        const width = row.reduce((sum, slot) => sum + slot.width, 0) + Math.max(0, row.length - 1) * GAP_X;
        let x = -width / 2;
        for (const slot of row) {
            centerX.set(slot.id, x + slot.width / 2);
            x += slot.width + GAP_X;
        }
    }
    const gap = (left: Slot, right: Slot) => (left.width + right.width) / 2 + GAP_X;
    for (let pass = 0; pass < RELAXATIONS; pass++) {
        const sequence = pass % 2 === 0 ? filled.slice(1) : filled.slice(0, -1).reverse();
        const neighbours = pass % 2 === 0 ? below : above;
        for (const row of sequence) {
            const desired = row.map((slot) => {
                const near = [...(neighbours.get(slot.id) ?? [])].map((other) => centerX.get(other)!);
                return near.length ? near.reduce((a, b) => a + b, 0) / near.length : centerX.get(slot.id)!;
            });
            // Keep the order and the gaps: push right from the left, then pull back left from the right, and
            // average the two placements.
            const forward = [...desired];
            for (let i = 1; i < row.length; i++) {
                forward[i] = Math.max(forward[i]!, forward[i - 1]! + gap(row[i - 1]!, row[i]!));
            }
            const backward = [...desired];
            for (let i = row.length - 2; i >= 0; i--) {
                backward[i] = Math.min(backward[i]!, backward[i + 1]! - gap(row[i]!, row[i + 1]!));
            }
            const placed = row.map((_, i) => (forward[i]! + backward[i]!) / 2);
            for (let i = 1; i < row.length; i++) {
                placed[i] = Math.max(placed[i]!, placed[i - 1]! + gap(row[i - 1]!, row[i]!));
            }
            row.forEach((slot, i) => centerX.set(slot.id, placed[i]!));
        }
    }

    // The top row first: each row is as high as its highest node.
    const positions: Record<string, {x: number; y: number}> = {};
    const rowSpan = new Map<number, {top: number; bottom: number}>();
    let y = 0;
    for (let layer = filled.length - 1; layer >= 0; layer--) {
        const row = filled[layer]!;
        const height = Math.max(0, ...row.flatMap((slot) => (slot.element ? [drdNodeHeight(slot.element)] : [])));
        rowSpan.set(layer, {top: y, bottom: y + height});
        for (const slot of row) {
            if (slot.element) positions[slot.id] = {x: centerX.get(slot.id)! - slot.width / 2, y};
        }
        y += height + GAP_Y;
    }
    // A virtual slot is a straight vertical lane through its row: it enters at the bottom and leaves at the top.
    const waypoints: DrdLayout['waypoints'] = {};
    for (const [id, chain] of chains) {
        if (chain.length === 0) continue;
        waypoints[id] = chain.flatMap((slot) => {
            const span = rowSpan.get(Number(slot.slice(slot.lastIndexOf('#') + 1)))!;
            const x = centerX.get(slot)!;
            return [
                {x, y: span.bottom},
                {x, y: span.top},
            ];
        });
    }
    return {positions, waypoints};
}
