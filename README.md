# Qodly AG Grid Component

## Overview

The Qodly AG Grid component wraps AG Grid and integrates it with Qodly data sources for high‑performance, infinite scrolling data grids. It supports server-side sorting and filtering via the bound Qodly datasource, single row selection synchronized with a current element, rich cell rendering/formatting, and theme customization via AG Grid's theme Quartz parameters.

![dataGrid](public/original.png)

![dataGrid](public/table.png)

## Key Features

- Infinite row model with paged fetching from a Qodly datasource
- Server-side sorting and filtering driven by column settings
- Single row selection (click to select), synchronized with a current element source
- Multi-column sorting (hold Shift and click headers), sorting order cycles asc → desc
- Text/Number/Date column filters with rich operators and multi-condition AND/OR
- Custom cell renderer:
  - Images (deferred URIs)
  - Boolean as checkbox or icon (check/close)
  - Slider for numeric values
  - General formatting via @ws-ui/formatter and formatValue
- Column state persistence (order, width, sort) to a Qodly source or localStorage
- Theming/styling via AG Grid Quartz theme parameters and CSS

## How it Works

- Build mode (editor): Renders a mock grid using defined columns to help design and preview styles.
- Render mode (runtime): Renders a live grid bound to a Qodly datasource with:
  - Infinite scrolling row model
  - Server-side sorting via `orderBy`
  - Server-side filtering by translating AG Grid filter models into Qodly query strings
  - Selection synchronized with an optional "Selected Element" source

## Data Access

Bind the following sources in the editor (Data Access group):

| Name                  | Type                                 | Required | Description                                                                                       |
| --------------------- | ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| Qodly Source          | Entity Selection / Array-like Scalar | Yes      | The main data source the grid reads from. Must be iterable.                                       |
| Selected Element      | Entity / Object Scalar               | No       | Current element bound to the selected row. The grid updates this when the user selects a row.     |
| State Source          | Scalar (object/array)                | No       | Optional; when provided and local storage is disabled, the grid saves/restores column state here. |
| Save In Local Storage | boolean                              | No       | If true, grid state is saved in `localStorage` instead of a Qodly source. Default: false.         |

Notes:

- The settings also expose a "Server Side" text field. It is reserved for platform integrations and not used directly by this component’s code.

## Columns Configuration

Configure columns in the "Columns" data grid setting:

- Title (string): Column header label
- Source (Qodly attribute): Attribute name to read from each entity
- Format (string): Optional format used by @ws-ui/formatter / formatValue (e.g., for dates, numbers, styles)
- Width (number): Initial width in pixels
- Flex (number): Flex size; AG Grid uses width/flex for layout
- Enable Sorting (boolean): Enable sorting (disabled for image/object types)
- Enable Filtering (boolean): Enable filtering (supported for text/string, number/long, and date)
- Locked Position (boolean): Lock column position
- Enable Sizing (boolean): Allow column resizing by the user

Data types and filtering:

- text/string → agTextColumnFilter with contains/equals/notEqual/startsWith/endsWith
- number/long → agNumberColumnFilter with equals/notEqual/greater*/less*/inRange
- date → agDateColumnFilter with equals/notEqual/greaterThan/lessThan/inRange

## Selection

- Row selection mode: single row
- Clicking a row selects it and, if "Selected Element" is bound, updates the bound current element to the selected entity.

## Sorting

- Enable per column using "Enable Sorting"
- Multi-sort by holding Shift and clicking additional headers
- Sorting order: asc → desc

## Filtering

- Enable per column using "Enable Filtering"
- Filters are translated into server-side Qodly queries
- Multi-condition filters (AND/OR) are supported by the UI and translated to combined queries

## Save/Restore Column State

The grid persists column state (order, width, sort) when it changes:

- If "Save In Local Storage" is true:
  - Saves to `localStorage` under key `gridState_<componentId>`
  - On load, applies state from localStorage if present
- Else if "State Source" is bound:
  - Saves the state array into the bound source
  - On load, reads the array and applies it
- State is emitted with the "On SaveState" event after it is updated

## Events

The component exposes the following events. Payloads (where applicable) are sent via `emit`:

- On Row Click (`onrowclick`)
- On Row Double Click (`onrowdblclick`)
- On Header Click (`onheaderclick`)
  - Payload: `{ column }`
- On Cell Click (`oncellclick`)
  - Payload: `{ column: string, value: any }`
- On Cell Double Click (`oncelldblclick`)
  - Payload: `{ column: string, value: any }`
- On Cell Key Down (`oncellkeydown`)
  - Payload: `{ column: string, value: any, key: string }`
- On Cell Mouse Over (`oncellmouseover`)
  - Payload: `{ column: string, value: any }`
- On Cell Mouse Out (`oncellmouseout`)
  - Payload: `{ column: string, value: any }`
- On Cell Mouse Down (`oncellmousedown`)
  - Payload: `{ column: string, value: any }`
- On SaveState (`onsavestate`)
  - Payload: `ColumnState[]` (AG Grid column state array)

## Properties (Styling & Behavior)

General

- Disabled (boolean)
- Class (CSS classes)
- Width/Height (unit fields)
- Spacing (unit)
- Accent Color (color)
- Background Color (color)
- Text Color (color)
- Font Size (unit)
- Enable Column Hover (boolean)
- Enable Cell Focus (boolean)

Border

- Border Color (color)
- Border Radius (unit)
- Row Border (boolean)
- Column Border (boolean)

Header

- Header Background Color (color)
- Header Text Color (color)
- Header Vertical Padding Scale (number)
- Header Column Border (boolean)
- Header Font Size (unit)
- Header Font Weight (400–900)

Cell

- Odd Row Background Color (color)
- Cell Horizontal Padding Scale (number)
- Row Vertical Padding Scale (number)

Icon

- Icon Size (unit)

These properties feed into AG Grid’s Quartz theme via `themeQuartz.withParams`.

## Styling

If you are familiar with CSS, you can style your component using AG Grid’s CSS selectors. You can also leverage the theme parameters listed above.

For more details: https://www.ag-grid.com/javascript-data-grid/theming-css/

Example CSS:

```CSS
/* Change the grid background */
self {
    background-color: #f9f9f9;
}

/* Change header font, color, and add a bottom border */
self .ag-header-cell {
    background-color: #343a40;
    color: #ffffff;
    font-size: 16px;
    font-weight: bold;
    border-bottom: 2px solid #000;
}

/* Center align the header text */
self .ag-header-cell-label {
    justify-content: center;
}

/* Add spacing between header cells */
self .ag-header-cell:not(:last-child) {
    border-right: 1px solid #ffffff;
}

/* Style grid rows */
self .ag-row {
    font-size: 14px;
    border-bottom: 1px solid #ddd;
}

/* Change row height */
self .ag-row {
    height: 40px;
}

/* Add hover effect on rows */
self .ag-row:hover {
    background-color: #e6f7ff;
}

/* Alternate row colors for better readability */
self .ag-row:nth-child(even) {
    background-color: #f8f9fa;
}

self .ag-row:nth-child(odd) {
    background-color: #ffffff;
}

/* Increase padding inside cells */
self .ag-cell {
    padding: 12px;
    font-size: 14px;
}

/* Add a border between cells */
self .ag-cell:not(:last-child) {
    border-right: 1px solid #dee2e6;
}

/* Align text to the center */
self .ag-cell {
    text-align: center;
}

/* Change background color for selected rows */
self .ag-row-selected {
    background-color: #e3e3e300 !important;
    color: #ffffff;
}

/* Customize borders */
self .ag-root {
    border: 2px solid #ccc;
}

/* Change sort icon color */
self .ag-header-cell .ag-header-icon {
    color: #ffffff;
}

/* Change filter icon color */
self .ag-header-icon .ag-icon-filter {
    color: #ffffff;
}

/* Customize filter icon */
self .ag-header-cell-filtered .ag-header-cell-label::after {
    content: ' 🔍';
    margin: 4px;
}

/* Customize the scrollbar */
self .ag-body-viewport::-webkit-scrollbar {
    width: 8px;
}

self .ag-body-viewport::-webkit-scrollbar-thumb {
    background: #007bff;
    border-radius: 4px;
}

self .ag-body-viewport::-webkit-scrollbar-thumb:hover {
    background: #0056b3;
}

/* Add animation */
self .ag-header-cell-text {
    background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet, red);
    font-weight: 600;
    font-size: 20px;
    animation: animatedTextGradient 2.5s linear infinite;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    background-size: 200% auto;
}

@keyframes animatedTextGradient {
    to {
        background-position: -200% center;
    }
}
```

Or customize CSS variables:

```CSS
self {
    /* override value of backgroundColor, foregroundColor and spacing parameters */
    --ag-background-color: darkred;
    --ag-foreground-color: lightpink;
    --ag-spacing: 4px;
    /* use dark scrollbars */
    --ag-browser-color-scheme: dark;
    /* use white text */
    --ag-text-color: white;
}
```

## Usage Checklist

1. Drag and drop the AgGrid component into your page.
2. Bind "Qodly Source" to an iterable selection or array-like scalar.
3. Optionally bind "Selected Element" to sync the current entity with row selection.
4. Define columns: set Title, Source, and settings (sorting, filtering, width/flex, etc.).
5. Optionally set "State Source", or toggle "Save In Local Storage" for column state persistence.
6. Adjust styling via General/Border/Header/Cell/Icon settings or CSS.

## Notes and Limitations

- Sorting is disabled for `image` and `object` data types by design.
- Filtering is supported for `text/string`, `number/long`, and `date` data types.
- Column state persistence covers order, width, and sort. Visibility state depends on whether you provide controls to toggle it.

## License

This project is licensed under the MIT License.
