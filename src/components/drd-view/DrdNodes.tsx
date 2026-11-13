import {IconCategory, IconGavel, IconServer} from '@tabler/icons-react';
import {Handle, Position, type Node, type NodeProps} from '@xyflow/react';
import type {ReactElement} from 'react';
import {cx} from '#ui/cx';
import {DRD_NODE_WIDTH, drdNodeHeight} from './drdLayout';
import type {DrdElement} from './requirementsGraph';
import styles from './drd.module.css';

/** The data of a diagram node: its element and how the current selection highlights it. */
export interface DrdNodeData extends Record<string, unknown> {
    element: DrdElement;
    emphasis?: 'selected' | 'related' | 'dimmed';
}

export type DrdNode = Node<DrdNodeData>;

// The requirement edges leave a node at its top and enter the requiring node at its bottom; an owner association
// joins two inputs side by side.
function Handles({target = true, source = true, sides = false}: {target?: boolean; source?: boolean; sides?: boolean}) {
    return (
        <>
            {target && <Handle type="target" position={Position.Bottom} id="in" className={styles.handle} />}
            {source && <Handle type="source" position={Position.Top} id="out" className={styles.handle} />}
            {sides && (
                <>
                    <Handle type="source" position={Position.Left} id="left" className={styles.handle} />
                    <Handle type="source" position={Position.Right} id="right" className={styles.handle} />
                </>
            )}
        </>
    );
}

function emphasisClass(data: DrdNodeData): string | undefined {
    return data.emphasis && styles[data.emphasis];
}

function Results({names}: {names?: string[]}): ReactElement | null {
    if (!names?.length) return null;
    const shown = names.slice(0, 3);
    return (
        <div className={styles.results} title={names.join(', ')}>
            {shown.map((name) => (
                <span key={name} className={styles.chip}>
                    {name}
                </span>
            ))}
            {names.length > shown.length && <span className={styles.more}>+{names.length - shown.length}</span>}
        </div>
    );
}

/** A DMN decision: a rectangle. */
export function DecisionNode({data}: NodeProps<DrdNode>): ReactElement {
    const {element} = data;
    return (
        <div
            className={cx(styles.node, styles.decision, emphasisClass(data))}
            style={{width: DRD_NODE_WIDTH, height: drdNodeHeight(element)}}
            data-testid={`drd-node-${element.id}`}
            data-kind="decision"
        >
            <Handles />
            <div className={styles.title}>
                <IconGavel size={14} className={styles.icon} aria-hidden="true" />
                <span className={styles.name} title={element.id}>
                    {element.name}
                </span>
            </div>
            {element.context && (
                <div className={styles.meta}>
                    {element.context.name}: <em>{element.context.type}</em>
                </div>
            )}
            <Results names={element.results} />
        </div>
    );
}

/** A DMN input data: a stadium; the facts of the type are in a tray below it, since facts arrive with the input. */
export function InputDataNode({data}: NodeProps<DrdNode>): ReactElement {
    const {element} = data;
    const facts = element.facts ?? [];
    return (
        <div
            className={cx(styles.inputWrap, emphasisClass(data))}
            style={{width: DRD_NODE_WIDTH}}
            data-testid={`drd-node-${element.id}`}
            data-kind="input"
        >
            <div className={cx(styles.node, styles.input)}>
                <Handles target={false} sides />
                <div className={styles.title}>
                    <IconCategory size={14} className={styles.icon} aria-hidden="true" />
                    <span className={styles.name}>{element.name}</span>
                </div>
                <div className={styles.meta}>
                    {element.fields ?? 0} {element.fields === 1 ? 'field' : 'fields'}
                    {facts.length > 0 && ` · ${facts.length} facts`}
                </div>
            </div>
            {facts.length > 0 && (
                <div className={styles.facts}>
                    <div className={styles.factsCaption}>facts</div>
                    {facts.map((fact) => (
                        <div key={fact} className={styles.fact}>
                            <span className={styles.factMark}>ƒ</span>
                            {fact}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** A DMN decision service: a rounded rectangle split by a line; the name above it, the parameters below. */
export function ServiceNode({data}: NodeProps<DrdNode>): ReactElement {
    const {element} = data;
    const parameters = element.parameters ?? [];
    return (
        <div
            className={cx(styles.node, styles.service, emphasisClass(data))}
            style={{width: DRD_NODE_WIDTH, height: drdNodeHeight(element)}}
            data-testid={`drd-node-${element.id}`}
            data-kind="service"
        >
            <Handles source={false} />
            <div className={styles.serviceTop}>
                <div className={styles.title}>
                    <IconServer size={14} className={styles.icon} aria-hidden="true" />
                    <span className={styles.name} title={element.id}>
                        {element.name}
                    </span>
                </div>
                <div className={styles.caption}>Decision service</div>
            </div>
            <div className={styles.serviceBottom}>
                <span className={styles.meta}>
                    {parameters.length === 0
                        ? 'no parameters'
                        : parameters.map((parameter) => (
                              <span key={parameter.name}>
                                  {parameter.name}: <em>{parameter.type}</em>{' '}
                              </span>
                          ))}
                </span>
            </div>
        </div>
    );
}

// `input` would take the default node styles of `@xyflow/react/dist/style.css`: the input node type is `inputData`.
export const DRD_NODE_TYPES = {decision: DecisionNode, inputData: InputDataNode, service: ServiceNode};

/** The node type of an element kind. */
export const NODE_TYPE_OF = {decision: 'decision', input: 'inputData', service: 'service'} as const;
