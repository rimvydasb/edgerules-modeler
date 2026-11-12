import {useState, type ReactElement} from 'react';
import {Button, Group, Modal, TextInput} from '@mantine/core';

export interface ProjectDialogProps {
    title: string;
    submitLabel: string;
    initialName: string;
    initialDescription?: string; // when set (even empty), the dialog asks for a description
    onCancel: () => void;
    onSubmit: (name: string, description: string | undefined) => void;
}

/** Asks for the name (and optionally the description) of a new or renamed project. */
export function ProjectDialog({
    title,
    submitLabel,
    initialName,
    initialDescription,
    onCancel,
    onSubmit,
}: ProjectDialogProps): ReactElement {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription ?? '');
    const [error, setError] = useState<string | undefined>();

    return (
        <Modal opened onClose={onCancel} title={title} size="sm">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const trimmed = name.trim();
                    if (!trimmed) return setError('A project needs a name.');
                    onSubmit(trimmed, initialDescription === undefined ? undefined : description.trim());
                }}
            >
                <TextInput
                    label="Name"
                    value={name}
                    error={error}
                    data-autofocus
                    onChange={(event) => {
                        setName(event.currentTarget.value);
                        setError(undefined);
                    }}
                />
                {initialDescription !== undefined && (
                    <TextInput
                        mt="sm"
                        label="Description"
                        value={description}
                        onChange={(event) => setDescription(event.currentTarget.value)}
                    />
                )}
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" color="dark">
                        {submitLabel}
                    </Button>
                </Group>
            </form>
        </Modal>
    );
}
