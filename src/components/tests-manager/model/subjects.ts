import {listCallables} from '#lib/callables';
import type {MutableDecisionService, TestSubject} from '../tests-manager-types';

// `'*'` plus every fully typed callable from `listCallables`. The model has no name of its own.
export function listTestSubjects(service: MutableDecisionService): TestSubject[] {
    const subjects: TestSubject[] = [{id: '*', kind: 'model', name: 'Model'}];

    for (const {path, kind} of listCallables(service)) {
        subjects.push({id: path, kind, name: path});
    }

    return subjects;
}
