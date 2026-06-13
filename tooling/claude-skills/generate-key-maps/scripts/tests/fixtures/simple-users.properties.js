// Fixture only — never executed.
const filters = [
  {
    field_name: 'User Name',
    field_id: 'user_name',
    field_type: 'string',
    filter_type: 'search_in_string',
    group_name: 'User',
  },
  {
    field_name: 'User Email',
    field_id: 'user_email',
    field_type: 'string',
    filter_type: 'search_in_string',
    group_name: 'User',
  },
  {
    field_name: 'Department',
    field_id: 'user_department_id',
    field_type: 'dynamic_filter',
    entity: 'department',
    filter_type: 'objectId',
    group_name: 'User',
  },
  {
    field_name: 'Department Name',
    field_id: 'user_department_name',
    field_type: 'string',
    filter_type: 'search_in_string',
    group_name: 'User',
  },
  {
    field_name: 'Owner',
    field_id: 'user_owner_id',
    field_type: 'dynamic_filter',
    entity: 'simple_users',
    filter_type: 'objectId',
    group_name: 'User',
  },
];

// `default_props.columns` style — declares fields that should appear as
// table columns. Fields appearing ONLY here (not in `filters` above) are
// "column-only" — they need key_map entries but have no filter UI.
// `user_status` and `user_archive` below are column-only — they exercise
// the parser path that was broken in Task 4 (field_ids arrays were skipped).
const columns = [
  { field_ids: ['user_name', 'user_email', 'user_department_name'] },
  { field_ids: ['user_status', 'user_archive'] }, // column-only
];
const columns_ui = {};

module.exports = { filters, columns, columns_ui };
