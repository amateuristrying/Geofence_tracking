# Live Tracker - Standalone Application

This is a standalone version of the UniFleet Live Dashboard page, packaged as an independent Next.js application.

## Features

- **Real-time Fleet Monitoring**: Live tracking of all vehicles with real-time updates
- **Interactive Map**: Mapbox-powered map with vehicle markers and geofences
- **Multi-Region Support**: Toggle between TZ (Tanzania) and ZM (Zambia) operations
- **Vehicle Status Filtering**: Filter vehicles by status (Moving, Stopped, Parked, Idle, Offline)
- **Geofence Management**: View, create, and manage geofences
- **Live Insights**: Real-time analytics and KPIs
- **Data Inspector**: Debug tool for viewing raw tracker data

## Prerequisites

- Node.js 18+ and npm
- Valid Navixy API session keys
- Mapbox API token
- (Optional) Supabase account for additional features

## Installation

1. **Install Dependencies**

```bash
npm install
```

2. **Configure Environment Variables**

The `.env.local` file is already included with your API keys. If you need to update them, edit the following variables:

```env
# Navixy API Keys
NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ=your_tanzania_session_key
NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM=your_zambia_session_key
NEXT_PUBLIC_NAVIXY_SESSION_KEY=your_default_session_key

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

3. **Run the Development Server**

```bash
npm run dev
```

The application will be available at `http://localhost:3000/live`

## Production Build

To create a production build:

```bash
npm run build
npm start
```

## Project Structure

```
live-tracker-standalone/
├── src/
│   ├── app/
│   │   ├── live/
│   │   │   └── page.tsx          # Main live dashboard page
│   │   ├── layout.tsx             # App layout
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── LiveTracker.tsx        # Main dashboard component
│   │   ├── RealtimeMap.tsx        # Map component
│   │   ├── RealtimeInsights.tsx   # Analytics component
│   │   ├── GeofencePanel.tsx      # Geofence management
│   │   ├── IdleStatusIndicator.tsx
│   │   ├── NavixyDataInspector.tsx
│   │   └── GeofenceMapOverlay.tsx
│   ├── hooks/
│   │   ├── useNavixyRealtime.ts   # Real-time data hook
│   │   ├── useFleetAnalysis.ts    # Fleet analytics hook
│   │   ├── useGeofences.ts        # Geofence management hook
│   │   └── useTrackerStatusDuration.ts
│   ├── services/
│   │   ├── navixy.ts              # Navixy API service
│   │   └── navixy-socket.ts       # WebSocket service
│   ├── types/
│   │   ├── geofence.ts
│   │   ├── telemetry.ts
│   │   └── security.ts
│   └── lib/
│       ├── utils.ts
│       ├── supabase.ts
│       └── ...
├── public/                         # Public assets
├── .env.local                      # Environment variables
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

## Usage

### Accessing the Dashboard

1. Navigate to `http://localhost:3000/live` after starting the server
2. The dashboard will automatically load and connect to the Navixy API
3. Use the region toggle (TZ/ZM) to switch between Tanzania and Zambia operations

### Features Guide

#### Real-Time Monitoring
- View all vehicles on the map with live position updates
- Click on any vehicle marker to see detailed information
- Status is automatically updated every few seconds

#### Filtering
- Use the filter buttons in the side panel to filter vehicles by status:
  - **Moving**: Vehicles currently in motion
  - **Stopped**: Vehicles stopped temporarily
  - **Parked**: Vehicles parked (ignition off)
  - **Idle-Stopped**: Vehicles idle while stopped
  - **Idle-Parked**: Vehicles idle while parked
  - **Offline**: Vehicles with no recent GPS signal

#### Geofence Management
- Click on the geofence view to manage geofences
- View all active geofences with vehicle counts
- Create new geofences (polygon, corridor, or circle)
- Delete existing geofences

#### Data Inspector
- Use the floating data inspector for debugging
- View raw tracker state data
- Monitor WebSocket connections

## Tech Stack

- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **API**: Navixy Fleet Tracking API
- **Real-time**: WebSocket connections
- **State Management**: React Hooks

## Troubleshooting

### No data showing
- Check that your Navixy session keys are valid in `.env.local`
- Ensure you have an active internet connection
- Verify your Navixy account has trackers assigned

### Map not loading
- Verify your Mapbox token is valid in `.env.local`
- Check browser console for errors

### Build errors
- Ensure all dependencies are installed: `npm install`
- Clear the Next.js cache: `rm -rf .next`
- Try rebuilding: `npm run build`

## Support

For issues or questions about the Navixy API, refer to the [Navixy API Documentation](https://docs.navixy.com/).

For Next.js issues, refer to the [Next.js Documentation](https://nextjs.org/docs).

## License

This is a proprietary application for UniFleet operations.
