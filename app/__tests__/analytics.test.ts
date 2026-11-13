import {describe, expect, it} from 'vitest';
import type {CaptureResult} from 'posthog-js';
import {redactProjectUrls, redactUrl} from '../analytics';

describe('redactUrl', () => {
    it('hides the project and element names of a project URL', () => {
        expect(redactUrl('https://x.github.io/edgerules-modeler/project/my-loans/applicant.age?view=flow')).toBe(
            'https://x.github.io/edgerules-modeler/project/:project',
        );
        expect(redactUrl('/project/secret-client')).toBe('/project/:project');
    });

    it('keeps the public pages unchanged', () => {
        const url = 'https://x.github.io/edgerules-modeler/examples/banking/loan?view=flow';
        expect(redactUrl(url)).toBe(url);
    });
});

describe('redactProjectUrls', () => {
    it('redacts every URL-valued property of an event', () => {
        const event = {
            uuid: '1',
            event: '$pageleave',
            properties: {
                $current_url: 'https://h/project/a/b',
                $pathname: '/project/a/b',
                $prev_pageview_pathname: '/project/a',
                $referrer: 'https://h/project/a',
                other: '/project/a',
            },
            $set_once: {$initial_current_url: 'https://h/project/a'},
        } as CaptureResult;
        const result = redactProjectUrls(event)!;
        expect(result.properties).toEqual({
            $current_url: 'https://h/project/:project',
            $pathname: '/project/:project',
            $prev_pageview_pathname: '/project/:project',
            $referrer: 'https://h/project/:project',
            other: '/project/a',
        });
        expect(result.$set_once).toEqual({$initial_current_url: 'https://h/project/:project'});
    });
});
