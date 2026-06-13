/* eslint-disable */
// @ts-nocheck
// Fixture only — never executed. Tests parser follow-through on ES imports.
// Mirrors the shape of dashboard-api files like
// `policy-version-history.properties.ts` that wrap a v2Table file via
// `import x from './v2Table/...'` and re-export its filters/columns.
import simpleUsers from './simple-users.properties';

export const filters = simpleUsers.filters;
export const columns = simpleUsers.columns;
export const columns_ui = simpleUsers.columns_ui;
