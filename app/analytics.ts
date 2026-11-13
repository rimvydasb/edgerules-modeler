import posthog, {type CaptureResult} from 'posthog-js';

/**
 * Page analytics of the hosted Modeler (PostHog), set up to need no consent banner under the ePrivacy Directive
 * (Art. 5(3)) and to keep the GDPR footprint minimal:
 *
 * - `cookieless_mode: 'always'` — no cookies, no localStorage/sessionStorage; PostHog derives an anonymous,
 *   daily-rotating visitor hash on its servers. Nothing is stored on or read from the visitor's device.
 * - Only `$pageview` / `$pageleave`: no autocapture, session replay, heatmaps, surveys, flags or person profiles.
 * - Project URLs are reduced to `/project/:project`: project and element names come from the visitor's own
 *   local workspace and are not sent.
 * - Do Not Track / Global Privacy Control are honoured.
 *
 * Analytics is on only in a `vite build` with `POSTHOG_PROJECT_TOKEN` set (see app/vite.config.ts), so
 * `npm run dev` and tests send nothing. The PostHog project must be in the EU cloud with "Cookieless server hash
 * mode" enabled and "Discard client IP data" on — see app/public/privacy.html.
 */
export function initAnalytics(token: string = __POSTHOG_PROJECT_TOKEN__): void {
    if (!token) return;
    posthog.init(token, {
        api_host: 'https://eu.i.posthog.com',
        cookieless_mode: 'always',
        persistence: 'memory',
        person_profiles: 'never',
        respect_dnt: true,
        capture_pageview: 'history_change',
        capture_pageleave: true,
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        mask_personal_data_properties: true,
        before_send: redactProjectUrls,
    });
}

const URL_PROPERTIES = ['$current_url', '$pathname', '$referrer', '$prev_pageview_pathname', '$initial_current_url'];

/** Replaces `/project/<name>/<element>?…` in every URL-valued property with `/project/:project`. */
export function redactProjectUrls(event: CaptureResult | null): CaptureResult | null {
    if (!event) return event;
    for (const target of [event.properties, event.$set, event.$set_once]) {
        if (!target) continue;
        for (const name of URL_PROPERTIES) {
            const value = target[name];
            if (typeof value === 'string') target[name] = redactUrl(value);
        }
    }
    return event;
}

export function redactUrl(value: string): string {
    return value.replace(/\/project\/[^#]*/, '/project/:project');
}
