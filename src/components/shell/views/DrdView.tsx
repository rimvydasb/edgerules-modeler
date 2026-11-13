import {useMemo, type ReactElement} from 'react';
import {DecisionRequirementsDiagram, type DrdOpenTarget} from '../../flow-editor';
import {useProjectSession} from '../../project-session';

export interface DrdViewProps {
    root: string; // the root path of the Shell: its element is selected in the diagram
    version: number; // the model version: a model change draws the diagram again
    onOpen: (target: DrdOpenTarget) => void;
}

/**
 * The Decision Requirements Diagram of the whole model, on every model path, with the element of the root path
 * selected. From the linked `get('*')`: its `requires` objects are the
 * requirements. A model that does not link has no requirements; the diagram then shows the elements only.
 */
export function DrdView({root, version, onOpen}: DrdViewProps): ReactElement {
    const session = useProjectSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const model = useMemo(() => session.engine.get('*'), [session, version]);
    return <DecisionRequirementsDiagram model={model} focus={root} onOpen={onOpen} />;
}
