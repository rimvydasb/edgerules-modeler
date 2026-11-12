// The validation limits of the tool inputs (webmcp-story.md, "Shared input types").

export const LIMITS = {
    operationCode: 50_000, // `code` of one operation
    batchMin: 1, // `operations`, `items`
    batchMax: 50,
    documentationText: 20_000,
    testValueText: 2_000,
    listLimitMin: 1, // `limit` of a list
    listLimitMax: 200,
    listLimitDefault: 100,
    searchQueryMin: 1, // `query` of `search-model`
    searchQueryMax: 200,
} as const;

// List and status results fit in this many characters of JSON (webmcp-story.md, "Tool design rules").
export const LIST_OUTPUT_BUDGET = 1_500;
