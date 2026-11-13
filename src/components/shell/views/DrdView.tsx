import {useMemo, useState, type ReactElement} from 'react';
import {BoxedEditor, type BoxedEditorOpenTarget, type BoxedEditorService} from '../../boxed-editor';
import type {CodeEditorService} from '../../code-editor';
import {DecisionRequirementsDiagram, type DrdOpenTarget} from '../../drd-view';
import {useProjectSession} from '../../project-session';
import * as classes from '../shell.module.css';

export interface DrdViewProps {
    root: string; // the root path of the Shell: its element is selected in the diagram
    version: number; // the model version: a model change draws the diagram again
    boxedService: BoxedEditorService; // one per session; shows the selected element in the split screen
    languageService: CodeEditorService;
    readOnly?: boolean;
    split?: boolean; // shows the selected element right of the diagram
    onOpen: (target: DrdOpenTarget) => void; // a double click on an element
    onOpenNode: (target: BoxedEditorOpenTarget) => void;
    onExpand?: (path: string) => void; // the `Expand` button of the split screen Boxed Editor: open it in the Boxed view
}

/**
 * The Decision Requirements Diagram of the whole model, on every model path, with the element of the root path
 * selected. From the linked `get('*')`: its `requires` objects are the
 * requirements. A model that does not link has no requirements; the diagram then shows the elements only. With the
 * split screen on, the selected element shows on the right in a Boxed Editor: a decision or a service at its path, an
 * input data at its type. A click on the empty diagram clears the selection and closes the panel.
 */
export function DrdView({
    root,
    version,
    boxedService,
    languageService,
    readOnly,
    split,
    onOpen,
    onOpenNode,
    onExpand,
}: DrdViewProps): ReactElement {
    const session = useProjectSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const model = useMemo(() => session.engine.get('*'), [session, version]);
    const [selection, setSelection] = useState<DrdOpenTarget | undefined>();
    return (
        <div className={classes.split}>
            <div className={classes.splitCanvas}>
                <DecisionRequirementsDiagram
                    model={model}
                    focus={root}
                    onOpen={onOpen}
                    onSelectionChange={setSelection}
                    style={{height: '100%'}}
                />
            </div>
            {split && selection && (
                <div className={classes.splitPanel} data-testid="shell-split-panel">
                    <BoxedEditor
                        key={selection.path}
                        service={boxedService}
                        path={selection.path}
                        revision={version}
                        readOnly={readOnly}
                        onOpenNode={onOpenNode}
                        languageService={languageService}
                        documentationService={session.documentation}
                        // The split screen is narrow: the selected element shows without its description.
                        showDescription={false}
                        onExpand={onExpand && (() => onExpand(selection.path))}
                    />
                </div>
            )}
        </div>
    );
}
