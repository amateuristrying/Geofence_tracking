# Quick Start Guide - UniFleet Live Tracker

## 🚀 Getting Started in 3 Steps

### Step 1: Extract & Navigate
```bash
# Extract the zip file
unzip live-tracker-standalone.zip

# Navigate to the directory
cd live-tracker-standalone
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run the Application
```bash
npm run dev
```

**That's it!** Open your browser and go to:
👉 **http://localhost:3000/live**

---

## 📋 What's Already Configured

✅ **Environment Variables** - All API keys are pre-configured in `.env.local`
✅ **Navixy Integration** - Both TZ and ZM operations ready to use
✅ **Mapbox Maps** - Map rendering configured and ready
✅ **All Dependencies** - Complete Next.js 16 setup with TypeScript

---

## 🎯 Key Features

- **Real-Time Fleet Monitoring** - Live vehicle tracking with auto-refresh
- **Multi-Region Support** - Toggle between Tanzania (TZ) and Zambia (ZM) operations
- **Interactive Mapping** - Mapbox-powered maps with vehicle markers
- **Status Filtering** - Filter by Moving, Stopped, Parked, Idle, or Offline
- **Geofence Management** - Create and manage geofences directly on the map
- **Live Analytics** - Real-time KPIs and fleet insights
- **Debug Tools** - Built-in data inspector for troubleshooting

---

## 🔧 Optional: Production Deployment

When you're ready to deploy:

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 💡 Tips

1. **First load might take a few seconds** while Next.js compiles
2. **Check the browser console** if you encounter any issues
3. **Use the region toggle** (TZ/ZM) in the top bar to switch fleets
4. **Click any vehicle** in the side panel to focus on it on the map
5. **Use filter buttons** to view specific vehicle statuses

---

## 📞 Troubleshooting

**Map not loading?**
- Check that your internet connection is active
- Verify Mapbox token in `.env.local`

**No vehicles showing?**
- Ensure Navixy session keys are valid
- Try toggling between TZ and ZM regions

**Build errors?**
- Delete `node_modules` and `.next` folders
- Run `npm install` again

---

## 📦 What's Included

```
live-tracker-standalone/
├── 📄 README.md                     ← Detailed documentation
├── 📄 QUICK_START.md               ← This file
├── 📄 .env.local                    ← Pre-configured API keys
├── 📄 package.json                  ← Dependencies
├── 📁 src/
│   ├── 📁 app/live/                 ← Main dashboard page
│   ├── 📁 components/               ← UI components
│   ├── 📁 hooks/                    ← React hooks
│   ├── 📁 services/                 ← API services
│   ├── 📁 types/                    ← TypeScript types
│   └── 📁 lib/                      ← Utilities
└── 📁 public/                       ← Static assets
```

---

## 🎉 You're All Set!

The application is now running independently and ready to monitor your fleet operations in real-time.

For more detailed information, see **README.md**
