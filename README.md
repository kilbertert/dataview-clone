# 指数数据监控面板

ETF/Stock Index Monitoring Dashboard — a clone of the dataview monitoring app.

## Features

- **Main dashboard** (`index.html`): Real-time ETF data table with stats cards, sortable columns, and auto-refresh every 10 seconds.
- **Time-series view** (`stockTimeseries.html`): Datetime range filter, paginated pivot table (products × time points), and CSV export.

## Stack

- Pure vanilla HTML + CSS + JavaScript (no framework)
- Node.js mock backend (no external dependencies)

## Project Structure

```
dataview-clone/
├── index.html              # Main dashboard
├── stockTimeseries.html    # Time-series view
├── css/
│   └── main.css            # Styles (CSS variables, gradient header, table, animations)
├── js/
│   ├── config.js           # BASE_API_URL (localhost:8000 or /api)
│   ├── common/
│   │   └── formatter.js    # Shared formatting utilities
│   ├── app.js              # Main dashboard logic
│   └── stockTimeseries.js  # Time-series page logic
├── server.js               # Mock backend server
└── README.md
```

## Quick Start

**Requirements:** Node.js (any version ≥ 12)

```bash
# Start the mock server
node server.js
```

Then open your browser at:

- Main dashboard: http://localhost:8000/
- Time-series: http://localhost:8000/stockTimeseries.html

## API Endpoints (Mock)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dataApi/getAllData` | Returns statistics + ETF list |
| GET | `/api/dataApi/getTimeSeriesData` | Returns paginated time-series data |

### Query parameters for `getTimeSeriesData`

| Param | Type | Description |
|-------|------|-------------|
| `startTime` | `string` | Start datetime (`yyyy-MM-dd HH:mm:ss`) |
| `endTime` | `string` | End datetime (`yyyy-MM-dd HH:mm:ss`) |
| `page` | `number` | Page number (default: 1) |
| `size` | `number` | Page size (default: 10) |

## Deploying with a Real Backend

Update `js/config.js` to point to your production API URL, or deploy behind an Nginx proxy that routes `/api` to your backend service.
