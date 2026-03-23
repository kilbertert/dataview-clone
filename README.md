# 指数数据监控面板

ETF/Stock Index Monitoring Dashboard — a clone of the dataview monitoring app.

## Features

- **Main dashboard** (`index.html`): Real-time ETF data table with stats cards, sortable columns, and auto-refresh every 10 seconds.
- **Time-series view** (`stockTimeseries.html`): Datetime range filter, paginated pivot table (products × time points), and CSV export.

## Stack

- Pure vanilla HTML + CSS + JavaScript (no framework)
- Node.js backend — reads from iQuant SQLite DB, falls back to mock data

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
├── server.js               # Backend server (SQLite + mock fallback)
├── iquant_data_export.py   # iQuant strategy: writes real-time data to SQLite
└── README.md
```

## Quick Start (mock data)

**Requirements:** Node.js ≥ 12

```bash
node server.js
```

Open `http://localhost:8000` on the same machine.

If you want other devices to access the app, the server now listens on `0.0.0.0` by default and will print your LAN URLs at startup, for example `http://192.168.1.20:8000`.

## Real Data via iQuant

1. Open iQuant client → Strategy Editor → New Python Strategy
2. Paste the contents of `iquant_data_export.py`, set period to 1 minute, run in live mode
3. Install the SQLite driver for Node.js:
   ```bash
   npm install better-sqlite3
   ```
4. Start the server (DB path defaults to `C:\Users\Public\dataview\market_data.db`):
   ```bash
   node server.js
   # or with a custom DB path:
   DB_PATH="C:\your\path\market_data.db" node server.js
   # or with a different port:
   PORT=8080 DB_PATH="C:\your\path\market_data.db" node server.js
   ```

The server auto-detects the DB. If it exists and has data, real iQuant data is served; otherwise mock data is used transparently.

## Public / Internet Access

Running `DB_PATH="C:\your\path\market_data.db" node server.js` now binds the server to `0.0.0.0`, so devices on the same LAN can open the dashboard using the printed `http://<your-LAN-IP>:8000` address.

For true public internet access, you still need one of these outside the app:

1. open and forward the server port on your router / cloud firewall to this machine, or
2. put the app behind a reverse proxy on a public host, or
3. use a tunnel service / frp / ngrok / Cloudflare Tunnel.

The app itself is now ready to be served publicly once the network path is opened.

## API Endpoints

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
