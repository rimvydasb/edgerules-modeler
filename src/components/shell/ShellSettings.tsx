import {Modal, TextInput, Textarea, Tooltip} from '@mantine/core';
import type {PortableSetValue} from '@edgerules/portable';
import {IconSettings} from '@tabler/icons-react';
import {useState, type ReactElement} from 'react';
import {isPortableError} from '#lib/portable';
import {portableAtPath} from '#lib/portableUtils';
import {cx} from '#ui/cx';
import {useProjectSession} from '../project-session';
import {annotationAt, rootPathSegments} from './shell-path';
import * as classes from './shell.module.css';

export interface ShellSettingsProps {
    root: string; // '*' or the path of an annotated entity
}

// The values of the form when it opens.
interface SettingsForm {
    name: string;
    version: string;
    description: string;
}

// A field of the dialog is one ruled row of the sheet: the label (and its hint) on the left, the input on the right.
const FIELD_CLASSES = {
    root: classes.settingsField,
    label: classes.settingsLabel,
    description: classes.settingsHint,
    wrapper: classes.settingsInputCell,
    input: classes.settingsInput,
};

const KIND_LABELS: Record<string, string> = {workbook: 'Workbook', service: 'Service'};

// What the settings dialog calls the entity: its node annotation, else its kind.
function entityLabel(model: unknown, root: string, node: string | undefined): string {
    if (node !== undefined) return node;
    return KIND_LABELS[rootPathSegments(model, root).at(-1)?.kind ?? ''] ?? 'Entity';
}

/**
 * The header cell left of the view switch that opens the settings of the root path: the model ('*') or an annotated
 * entity: a `workbook`, a `service` or an annotated node. The dialog edits the name (the model name, or the
 * `@Name` / `name` of the annotation, `@name` in Portable), the
 * model version (the model only) and the description of the documentation store. The dialog is a sheet of glass in
 * the drawing of a Flow node: a one-step header with the kind tile, sharp 1px ruled rows, and a row of step cells at
 * the bottom; the page behind it shows through, blurred.
 */
export function ShellSettings({root}: ShellSettingsProps): ReactElement {
    const session = useProjectSession();
    const isModel = root === '*';
    const [form, setForm] = useState<SettingsForm | undefined>();
    const [error, setError] = useState<string | undefined>();
    const model = session.engine.toPortable();
    const annotation = annotationAt(model, root);
    const title = isModel ? 'Model settings' : `${entityLabel(model, root, annotation?.node)} settings`;

    const open = () => {
        const current = session.engine.toPortable();
        const metadata = session.getSlice('model').metadata;
        setForm({
            name: isModel ? (metadata.name ?? '') : (annotationAt(current, root)?.name ?? ''),
            version: isModel ? (metadata.version ?? '') : '',
            description: session.documentation.getDescription(root) ?? '',
        });
        setError(undefined);
    };
    const close = () => setForm(undefined);

    const save = (values: SettingsForm) => {
        const result = session.transaction(() => {
            if (isModel) {
                const metadata = {name: values.name, version: values.version};
                const command = session.execute({type: 'setModelMetadata', metadata});
                if (!command.ok) throw command.error;
            } else {
                const previous = portableAtPath(session.engine.toPortable(), root) as unknown as Record<
                    string,
                    unknown
                >;
                const name = values.name.trim();
                if (name !== (annotation?.name ?? '')) {
                    // An annotation-only `set` value updates the label and keeps the node; `null` removes the label.
                    // An annotation never changes whether the model links.
                    const written = session.engine.set(root, {
                        '@kind': previous['@kind'],
                        '@name': name === '' ? null : name,
                    } as PortableSetValue);
                    if (isPortableError(written)) throw new Error(written.message);
                }
            }
            if (values.description.trim() !== (session.documentation.getDescription(root) ?? '')) {
                session.documentation.setDescription(root, values.description.trim());
            }
        });
        if (!result.ok) {
            setError(result.error.message);
            return;
        }
        close();
    };

    return (
        <>
            <Tooltip label={title} position="bottom-end" withArrow>
                <button
                    type="button"
                    aria-label={title}
                    aria-haspopup="dialog"
                    className={cx(classes.viewButton, classes.settingsButton)}
                    onClick={open}
                    data-testid="shell-settings"
                >
                    <IconSettings aria-hidden="true" size={18} />
                </button>
            </Tooltip>
            <Modal
                opened={form !== undefined}
                onClose={close}
                title={
                    <>
                        <span className={classes.settingsTile} aria-hidden="true">
                            <IconSettings size={18} />
                        </span>
                        <span className={classes.settingsTitleText}>{title}</span>
                    </>
                }
                size="lg"
                radius={0}
                centered
                closeButtonProps={{iconSize: 18}}
                overlayProps={{backgroundOpacity: 0.12}}
                classNames={{
                    content: classes.settingsDialog,
                    header: classes.settingsHeader,
                    title: classes.settingsTitle,
                    close: classes.settingsClose,
                    body: classes.settingsBody,
                }}
            >
                {form && (
                    <form
                        className={classes.settingsForm}
                        onSubmit={(event) => {
                            event.preventDefault();
                            save(form);
                        }}
                    >
                        <TextInput
                            data-autofocus
                            variant="unstyled"
                            classNames={FIELD_CLASSES}
                            inputWrapperOrder={['label', 'input', 'description']}
                            label="Name"
                            description={
                                isModel
                                    ? 'The name of the model'
                                    : `The name of the @${annotation?.node ?? 'Node'} annotation; empty shows the field name`
                            }
                            placeholder={isModel ? 'Model' : root.split('.').at(-1)}
                            value={form.name}
                            onChange={(event) => setForm({...form, name: event.currentTarget.value})}
                        />
                        {isModel && (
                            <TextInput
                                variant="unstyled"
                                classNames={FIELD_CLASSES}
                                label="Version"
                                placeholder="1.0.0"
                                value={form.version}
                                onChange={(event) => setForm({...form, version: event.currentTarget.value})}
                            />
                        )}
                        <Textarea
                            variant="unstyled"
                            classNames={FIELD_CLASSES}
                            label="Description"
                            rows={4}
                            resize="vertical"
                            value={form.description}
                            onChange={(event) => setForm({...form, description: event.currentTarget.value})}
                        />
                        {error && (
                            <div role="alert" className={classes.settingsError}>
                                {error}
                            </div>
                        )}
                        <div className={classes.settingsActions}>
                            <button type="button" className={classes.settingsAction} onClick={close}>
                                Cancel
                            </button>
                            <button type="submit" className={cx(classes.settingsAction, classes.settingsSave)}>
                                Save
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}
