import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {SodasLoader} from '../SodasLoader';

describe('SodasLoader', () => {
    it('is an image named by its label, not a status region', () => {
        render(<SodasLoader label="Loading examples" size={32} />);
        const mark = screen.getByRole('img', {name: 'Loading examples'});
        expect(mark).toHaveStyle({width: '32px', height: '32px'});
        expect(screen.queryByRole('status')).toBeNull();
    });
});
