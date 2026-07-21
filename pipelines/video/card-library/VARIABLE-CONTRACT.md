# Variable Contracts

A variable entry becomes an object instead of a string:

```json
"subtitle": {
  "type": "string",
  "required": false,
  "role": "descriptor",
  "max_words": 6,
  "omit_unless": "it adds information the logo and name do not already convey — never flow narration such as 'First up in the demo'",
  "example": "Caption-first short-form editor"
}
```

Field definitions:

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `string` \| `number` \| `boolean` \| `object` \| `array` |
| `required` | yes | boolean. Replaces the `includes('optional')` substring hack. |
| `role` | yes for `string` | see role table below |
| `enum` | no | array of legal values; validator rejects anything else |
| `max_words` | no | integer; validator counts whitespace-separated tokens |
| `max_chars` | no | integer |
| `shape` | no | for `type: object` / `array` — nested contract, same field set |
| `item_shape` | no | for `type: array` — contract each element must satisfy |
| `omit_unless` | no | model-facing prose; only meaningful when `required: false` |
| `example` | yes for `string` | a correct value, shown to the LLM |

Role table (`role` is the editorial contract — this is what stops sentence-shaped headings):

| role | Meaning | Validator enforces |
|---|---|---|
| `heading` | Title-like. Reads as a heading, not a sentence. | `max_words` default 7; **no terminal `.`**; **at most 1 comma** |
| `sentence` | A spoken line, may be verbatim VO. | `max_words` default 18 |
| `label` | Chip/pill/row label. | `max_words` default 5; no terminal `.` |
| `descriptor` | Positioning line under a name. | `max_words` default 6; no terminal `.` |
| `value` | A number carrying its unit. | must match `/[0-9]/` |
| `logo_slug` | A `logos/registry.json` slug. | existing logo-registry check |
| `icon_name` | An icon-set name. | must be in the card's `enum` |
| `free` | No editorial constraint. | nothing |
