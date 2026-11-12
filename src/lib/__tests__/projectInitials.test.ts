import {describe, expect, it} from 'vitest';
import {projectInitials} from '../projectInitials';

describe('projectInitials', () => {
    it('takes the first letters of the first two words', () => {
        expect(projectInitials('Client outreach')).toBe('CO');
        expect(projectInitials('Loan origination copy')).toBe('LO');
    });
    it('uses one letter for one word and skips a parenthesized suffix', () => {
        expect(projectInitials('Loans')).toBe('L');
        expect(projectInitials('Pricing (2)')).toBe('P');
    });
    it('has a fallback for an empty name', () => {
        expect(projectInitials('  ')).toBe('?');
    });
});
