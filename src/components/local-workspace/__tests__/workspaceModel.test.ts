import {describe, expect, it} from 'vitest';
import {formatBytes, savedAgo, slugOf, uniqueProjectName, uniqueProjectPath} from '../workspaceModel';

describe('workspaceModel', () => {
    it('suffixes taken names and paths', () => {
        expect(uniqueProjectName('X', new Set(['X', 'X (2)']))).toBe('X (3)');
        expect(uniqueProjectPath('Loan Repayment!', new Set(['loan-repayment']))).toBe('loan-repayment-2');
        expect(slugOf('***')).toBe('project');
    });

    it('formats times and sizes', () => {
        const now = Date.parse('2026-11-09T12:00:00Z');
        expect(savedAgo('2026-11-09T10:00:00Z', now)).toBe('saved 2 h ago');
        expect(savedAgo('2026-11-06T12:00:00Z', now)).toBe('saved 3 d ago');
        expect(formatBytes(3_355_443)).toBe('3.2 MB');
        expect(formatBytes(512)).toBe('512 B');
    });
});
