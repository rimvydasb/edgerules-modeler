import {useState, type ReactElement} from 'react';
import {Button, Group, Modal, Select, Text, TextInput} from '@mantine/core';
import {uniqueName, type CreateOption} from './create-templates';
import {isIdentifier} from './tree-model';

export interface CreateDialogProps {
    option: CreateOption; // the kind of the new entity
    taken: ReadonlySet<string>; // the root names the new entity must not take
    types?: readonly string[]; // the record types an `ofType` entity can be declared for
    onCancel: () => void;
    onCreate: (name: string, type?: string) => string | undefined; // an error message, or undefined on success
}

/**
 * Asks for the name of a new root entity. An `ofType` entity (a `facts`) first asks for its record type: the proposed
 * name follows the type (`ApplicantFacts`) until the user edits the name.
 */
export function CreateDialog({option, taken, types = [], onCancel, onCreate}: CreateDialogProps): ReactElement {
    const [type, setType] = useState<string | undefined>(() => (option.ofType ? types[0] : undefined));
    const proposedName = (forType?: string) => uniqueName(`${forType ?? ''}${option.defaultName}`, taken);
    const [name, setName] = useState(() => proposedName(type));
    const [nameEdited, setNameEdited] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const missingType = option.ofType === true && types.length === 0;

    const submit = () => {
        const trimmed = name.trim();
        if (option.ofType && type === undefined) {
            setError('Pick a type.');
        } else if (!isIdentifier(trimmed)) {
            setError('A name starts with a letter or _ and has only letters, digits and _.');
        } else if (taken.has(trimmed)) {
            setError(`"${trimmed}" already exists.`);
        } else {
            setError(onCreate(trimmed, type));
        }
    };

    return (
        <Modal opened onClose={onCancel} title={`New ${option.label.toLowerCase()}`} size="sm">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {option.ofType ? (
                    missingType ? (
                        <Text size="sm" c="dimmed" mb="sm" data-testid="create-no-types">
                            A {option.label.toLowerCase()} is declared for a type with fields. Create such a type in
                            Types first.
                        </Text>
                    ) : (
                        <Select
                            label="Type"
                            description={`The type the new ${option.label.toLowerCase()} derives fields for`}
                            data={[...types]}
                            value={type ?? null}
                            allowDeselect={false}
                            searchable
                            comboboxProps={{withinPortal: true}}
                            mb="sm"
                            onChange={(value) => {
                                const next = value ?? undefined;
                                setType(next);
                                if (!nameEdited) setName(proposedName(next));
                                setError(undefined);
                            }}
                        />
                    )
                ) : null}
                <TextInput
                    label="Name"
                    value={name}
                    error={error}
                    disabled={missingType}
                    data-autofocus
                    onChange={(event) => {
                        setName(event.currentTarget.value);
                        setNameEdited(true);
                        setError(undefined);
                    }}
                />
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={missingType}>
                        Create
                    </Button>
                </Group>
            </form>
        </Modal>
    );
}
