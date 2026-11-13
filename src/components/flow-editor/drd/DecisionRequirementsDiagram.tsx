import {useComputedColorScheme} from '@mantine/core';
import {IconHierarchy} from '@tabler/icons-react';
import {
    Background,
    BackgroundVariant,
    ConnectionMode,
    Controls,
    MarkerType,
    MiniMap,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    applyNodeChanges,
    useReactFlow,
    type Edge,
    type NodeChange,
} from '@xyflow/react';
import {useEffect, useMemo, useState, type CSSProperties, type ReactElement} from 'react';
import {cx} from '#ui/cx';
import {KIND_COLORS} from '#ui/kindColors';
import {layoutDrd, type DrdLayout} from './drdLayout';
import {DRD_NODE_TYPES, NODE_TYPE_OF, type DrdNode} from './DrdNodes';
import {DRD_EDGE_TYPES} from './RequirementEdge';
import {buildRequirementsGraph, type DrdElementKind, type DrdGraph} from './requirementsGraph';
import styles from './drd.module.css';

/** The element that a double click on a diagram node opens. */
export interface DrdOpenTarget {
    path: string; // the model path of a decision or a service; the type name of an input data
    kind: DrdElementKind;
}

export interface DecisionRequirementsDiagramProps {
    /** The linked model, as `get('*')` returns it; the `requires` of each decision and service draw the edges. */
    model: unknown;
    /** A model path to select: a decision, a service or a type name. A path that is not in the diagram selects none. */
    focus?: string;
    /** A double click on a node. */
    onOpen?: (target: DrdOpenTarget) => void;
    className?: string;
    style?: CSSProperties;
}

const FIT_VIEW = {padding: 0.15, maxZoom: 1.1};
const OWNER_LABEL: CSSProperties = {
    fill: 'var(--drd-muted)',
    fontFamily: 'var(--mantine-font-family-monospace)',
    fontSize: 10.5,
};
const OWNER_LABEL_BG: CSSProperties = {fill: 'var(--drd-surface)', stroke: 'var(--drd-border)'};
const MINIMAP_COLOR: Record<DrdElementKind, string> = {
    decision: KIND_COLORS.decision,
    input: KIND_COLORS.complexType,
    service: KIND_COLORS.service,
};

// The chain of `id`: the elements it requires, directly or through other elements (`up`), and the elements that
// require it (`down`). Both hold `id`.
interface Lineage {
    up: Set<string>;
    down: Set<string>;
}

function lineage(graph: DrdGraph, id: string): Lineage {
    const walk = (forward: boolean) => {
        const reached = new Set([id]);
        const visit = (from: string) => {
            for (const requirement of graph.requirements) {
                if (requirement.kind !== 'information') continue;
                const [near, far] = forward
                    ? [requirement.source, requirement.target]
                    : [requirement.target, requirement.source];
                if (near !== from || reached.has(far)) continue;
                reached.add(far);
                visit(far);
            }
        };
        visit(id);
        return reached;
    };
    return {up: walk(false), down: walk(true)};
}

// A requirement is on the chain when it joins two required elements or two requiring elements.
function onChain(chain: Lineage, source: string, target: string): boolean {
    return (chain.up.has(source) && chain.up.has(target)) || (chain.down.has(source) && chain.down.has(target));
}

function Legend({graph}: {graph: DrdGraph}): ReactElement {
    const count = (kind: DrdElementKind) => graph.elements.filter((element) => element.kind === kind).length;
    return (
        <div className={styles.legend} data-testid="drd-legend">
            <span className={styles.legendTitle}>Decision requirements</span>
            <span className={cx(styles.swatch, styles.decision)} />
            <span>Decision · {count('decision')}</span>
            <span className={cx(styles.swatch, styles.input)} />
            <span>Input data · {count('input')}</span>
            <span className={cx(styles.swatch, styles.service)} />
            <span>Decision service · {count('service')}</span>
            <svg className={styles.line} viewBox="0 0 30 10" aria-hidden="true">
                <line x1="1" y1="5" x2="23" y2="5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M22 1 L29 5 L22 9 Z" fill="currentColor" />
            </svg>
            <span>Information requirement</span>
            <svg className={styles.line} viewBox="0 0 30 10" aria-hidden="true">
                <line
                    x1="2"
                    y1="5"
                    x2="28"
                    y2="5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeDasharray="2 5"
                    strokeLinecap="round"
                />
            </svg>
            <span>Owner association</span>
        </div>
    );
}

function Diagram({model, focus, onOpen, className, style}: DecisionRequirementsDiagramProps): ReactElement {
    const colorScheme = useComputedColorScheme('light');
    const flow = useReactFlow();
    const graph = useMemo(() => buildRequirementsGraph(model), [model]);
    const [selected, setSelected] = useState<string | undefined>();
    // The positions of the automatic layout; a dragged node keeps its own until the graph changes.
    const [nodes, setNodes] = useState<DrdNode[]>([]);
    // The lanes of the long requirements; a requirement of a dragged node drops them and runs directly.
    const [waypoints, setWaypoints] = useState<DrdLayout['waypoints']>({});
    const [moved, setMoved] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        const {positions, waypoints: lanes} = layoutDrd(graph);
        setWaypoints(lanes);
        setMoved(new Set());
        setNodes(
            graph.elements.map((element) => ({
                id: element.id,
                type: NODE_TYPE_OF[element.kind],
                position: positions[element.id] ?? {x: 0, y: 0},
                data: {element},
                connectable: false,
            })),
        );
        setSelected((current) => (graph.elements.some((element) => element.id === current) ? current : undefined));
        const frame = window.requestAnimationFrame(() => void flow.fitView(FIT_VIEW));
        return () => window.cancelAnimationFrame(frame);
    }, [graph, flow]);

    // The focused path selects its element; a decision or a service by path, an input data by its type name.
    useEffect(() => {
        if (focus === undefined) return;
        const element = graph.elements.find((candidate) => candidate.id === focus || candidate.id === `type:${focus}`);
        setSelected(element?.id);
    }, [graph, focus]);

    const chain = useMemo(() => (selected ? lineage(graph, selected) : undefined), [graph, selected]);
    const related = useMemo(() => chain && new Set([...chain.up, ...chain.down]), [chain]);

    const shownNodes = useMemo(
        () =>
            nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    emphasis: !related
                        ? undefined
                        : node.id === selected
                          ? ('selected' as const)
                          : related.has(node.id)
                            ? ('related' as const)
                            : ('dimmed' as const),
                },
            })),
        [nodes, related, selected],
    );

    const edges = useMemo<Edge[]>(() => {
        const x = new Map(nodes.map((node) => [node.id, node.position.x]));
        return graph.requirements.map((requirement) => {
            const active =
                requirement.kind === 'owner'
                    ? related?.has(requirement.source) && related.has(requirement.target)
                    : chain && onChain(chain, requirement.source, requirement.target);
            const state = related ? (active ? styles.edgeActive : styles.edgeDimmed) : undefined;
            if (requirement.kind === 'owner') {
                const rightwards = (x.get(requirement.source) ?? 0) < (x.get(requirement.target) ?? 0);
                return {
                    id: requirement.id,
                    source: requirement.source,
                    target: requirement.target,
                    sourceHandle: rightwards ? 'right' : 'left',
                    targetHandle: rightwards ? 'left' : 'right',
                    label: requirement.label,
                    labelStyle: OWNER_LABEL,
                    labelBgStyle: OWNER_LABEL_BG,
                    labelBgPadding: [6, 2] as [number, number],
                    labelBgBorderRadius: 8,
                    className: cx(styles.owner, state),
                    focusable: false,
                    selectable: false,
                };
            }
            const lanes =
                moved.has(requirement.source) || moved.has(requirement.target) ? undefined : waypoints[requirement.id];
            return {
                id: requirement.id,
                type: 'requirement',
                data: {waypoints: lanes},
                source: requirement.source,
                target: requirement.target,
                sourceHandle: 'out',
                targetHandle: 'in',
                className: cx(styles.information, state),
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 16,
                    height: 16,
                    color: active ? 'var(--drd-focus)' : 'var(--drd-wire)',
                },
                focusable: false,
                selectable: false,
            };
        });
    }, [graph, nodes, related, chain, waypoints, moved]);

    return (
        <div className={cx(styles.diagram, className)} style={style} data-testid="drd">
            <ReactFlow
                nodes={shownNodes}
                edges={edges}
                nodeTypes={DRD_NODE_TYPES}
                edgeTypes={DRD_EDGE_TYPES}
                onNodesChange={(changes: NodeChange<DrdNode>[]) => {
                    const dragged = changes.flatMap((change) =>
                        change.type === 'position' && change.dragging ? [change.id] : [],
                    );
                    if (dragged.length > 0) setMoved((current) => new Set([...current, ...dragged]));
                    setNodes((current) => applyNodeChanges(changes, current));
                }}
                onNodeClick={(_, node) => setSelected((current) => (current === node.id ? undefined : node.id))}
                onNodeDoubleClick={(_, node) => {
                    const element = graph.elements.find((candidate) => candidate.id === node.id);
                    if (!element) return;
                    onOpen?.({path: element.kind === 'input' ? element.name : element.id, kind: element.kind});
                }}
                onPaneClick={() => setSelected(undefined)}
                connectionMode={ConnectionMode.Loose}
                nodesConnectable={false}
                edgesFocusable={false}
                deleteKeyCode={null}
                zoomOnDoubleClick={false}
                colorMode={colorScheme}
                minZoom={0.15}
                maxZoom={2}
                fitView
                fitViewOptions={FIT_VIEW}
                proOptions={{hideAttribution: true}}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} className={styles.background} />
                <Controls position="bottom-left" showInteractive={false} className={styles.controls} />
                {graph.elements.length > 0 && (
                    <>
                        <Panel position="top-left">
                            <Legend graph={graph} />
                        </Panel>
                        <MiniMap
                            position="bottom-right"
                            pannable
                            zoomable
                            ariaLabel="Diagram overview"
                            className={styles.minimap}
                            nodeColor={(node) => MINIMAP_COLOR[(node.data as DrdNode['data']).element.kind]}
                            nodeBorderRadius={4}
                        />
                    </>
                )}
                {graph.elements.length === 0 && (
                    <Panel position="top-center" className={styles.emptyPanel}>
                        <div className={styles.empty} data-testid="drd-empty">
                            <IconHierarchy size={28} stroke={1.5} />
                            <strong>No decisions to draw</strong>
                            <span>
                                The diagram shows each <code>decision</code> and <code>service</code> of the model with
                                the decisions and the input data that it requires.
                            </span>
                        </div>
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
}

/**
 * The Decision Requirements Diagram (DMN DRD) of a whole model: the decisions as rectangles, the structure types they
 * read as input data stadiums with their facts, and the services as decision services. An arrow points from the
 * required element to the requiring one; a dotted line joins a child input type to its owner. Read only: a click
 * highlights the requirement chain of a node, a double click opens it. The host imports `@xyflow/react/dist/style.css`.
 */
export function DecisionRequirementsDiagram(props: DecisionRequirementsDiagramProps): ReactElement {
    return (
        <ReactFlowProvider>
            <Diagram {...props} />
        </ReactFlowProvider>
    );
}
