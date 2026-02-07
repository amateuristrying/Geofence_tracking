'use client';

import React, { useState, useEffect } from 'react';
import { useNavixyRealtime } from '../hooks/useNavixyRealtime';
import { useFleetAnalysis } from '../hooks/useFleetAnalysis';

import { useGeofences } from '../hooks/useGeofences';
import RealtimeMap from './RealtimeMap';
import RealtimeInsights from './RealtimeInsights';
import GeofencePanel from './GeofencePanel';
import VehicleSearch from './VehicleSearch';
import VehiclePanel from './VehiclePanel';

import NavixyDataInspector from './NavixyDataInspector';
import { Loader2, ArrowLeft, RefreshCw, MapPin, Truck } from 'lucide-react';
import { NavixyService } from '../services/navixy';
import { cn } from '@/lib/utils';
import type { CreateZonePayload } from '../types/geofence';
import { CUSTOM_TRACKER_LABELS } from '../config/vehicleDirectory';
import { useSearchParams } from 'next/navigation';

// Main mode: geofence monitoring vs fleet monitoring
type MainMode = 'geofence' | 'fleet';

export default function LiveTracker() {
    const searchParams = useSearchParams();
    const geofenceIdParam = searchParams.get('geofence_id');
    const trackerIdParam = searchParams.get('tracker_id');
    const viewModeParam = searchParams.get('view');
    const regionParam = searchParams.get('region') as 'TZ' | 'ZM' | null;

    const isLocked = viewModeParam === 'locked';
    const isVehicleLocked = isLocked && !!trackerIdParam;
    const isGeofenceLocked = isLocked && !!geofenceIdParam;

    const [trackerIds, setTrackerIds] = useState<number[]>([]);
    const [trackerLabels, setTrackerLabels] = useState<Record<number, string>>({});

    // Main Mode State (geofence vs fleet)
    const [mainMode, setMainMode] = useState<MainMode>('geofence');

    // State for Drill-Down View (within geofence mode)
    const [currentView, setCurrentView] = useState<'summary' | 'traffic' | 'geofences' | 'monitor'>('summary');
    const [focusedAction, setFocusedAction] = useState<any | null>(null);
    const [focusedId, setFocusedId] = useState<number | null>(null);

    // Vehicle Mode State
    const [selectedTrackerId, setSelectedTrackerId] = useState<number | null>(null);
    const [fleetRegion, setFleetRegion] = useState<'TZ' | 'ZM'>('TZ');

    // Geofence Drawing State
    const [drawingMode, setDrawingMode] = useState<'none' | 'polygon' | 'corridor' | 'circle'>('none');
    const [drawnPayload, setDrawnPayload] = useState<CreateZonePayload | null>(null);

    // Monitored Geofences State (user-selected from GeofencePanel)
    const [monitoredZoneIds, setMonitoredZoneIds] = useState<number[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Region/Ops State - use fleet region when in fleet mode, otherwise URL or default
    const [region, setRegion] = useState<'TZ' | 'ZM'>(regionParam || 'TZ');

    // Determine the active session key based on mode
    const activeRegion = mainMode === 'fleet' ? fleetRegion : region;
    const sessionKey = activeRegion === 'TZ'
        ? (process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_TZ || process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY)
        : process.env.NEXT_PUBLIC_NAVIXY_SESSION_KEY_ZM;

    useEffect(() => {
        if (!sessionKey || sessionKey === 'replace_with_your_session_key') return;

        // Reset state when switching regions
        setTrackerIds([]);
        setTrackerLabels({});

        const initTrackers = async () => {
            try {
                const list = await NavixyService.listTrackers(sessionKey);

                if (list && list.length > 0) {
                    const labels: Record<number, string> = {};
                    const ids: number[] = [];

                    list.forEach((t: any) => {
                        // Logic from instructions: use source.id if available
                        const id = t.source?.id || t.id;
                        if (id) {
                            ids.push(id);
                            labels[id] = t.label;
                        }
                    });

                    console.log('Loaded Trackers:', ids.length);
                    setTrackerIds(ids);
                    // Merge API labels with manual overrides from config
                    setTrackerLabels({ ...labels, ...CUSTOM_TRACKER_LABELS });
                } else {
                    console.warn('No trackers found or failed to list trackers.');
                }
            } catch (err) {
                console.error('Failed to init trackers:', err);
            }
        };
        initTrackers();
    }, [sessionKey]);

    const { trackerStates, loading } = useNavixyRealtime(trackerIds, sessionKey);
    const analysis = useFleetAnalysis(trackerStates);

    // Geofence Hook
    const {
        zones, selectedZoneId, setSelectedZoneId,
        createZone, refreshZones
    } = useGeofences(trackerStates, sessionKey, trackerIds);

    // Auto-select geofence from URL if in locked mode
    useEffect(() => {
        if (isGeofenceLocked && geofenceIdParam) {
            const id = Number(geofenceIdParam);
            if (!isNaN(id)) {
                setSelectedZoneId(id);
                setCurrentView('geofences');
                setMainMode('geofence');
            }
        }
    }, [isGeofenceLocked, geofenceIdParam, setSelectedZoneId]);

    // Auto-select vehicle from URL if in locked mode
    useEffect(() => {
        if (isVehicleLocked && trackerIdParam) {
            const id = Number(trackerIdParam);
            if (!isNaN(id)) {
                setSelectedTrackerId(id);
                setMainMode('fleet');
                // Set region from URL
                if (regionParam) {
                    setFleetRegion(regionParam);
                    setRegion(regionParam);
                }
            }
        }
    }, [isVehicleLocked, trackerIdParam, regionParam]);

    const trackerList = Object.entries(trackerStates).map(([id, state]) => ({
        id: Number(id),
        state
    }));

    // Get all tracker states for the map
    const filteredTrackerStates = trackerList.reduce((acc, { id, state }) => {
        acc[id] = state;
        return acc;
    }, {} as Record<number, any>);

    // For vehicle locked mode, filter to only the selected vehicle
    const mapTrackers = isVehicleLocked && selectedTrackerId && trackerStates[selectedTrackerId]
        ? { [selectedTrackerId]: trackerStates[selectedTrackerId] }
        : selectedTrackerId && mainMode === 'fleet' && trackerStates[selectedTrackerId]
            ? { [selectedTrackerId]: trackerStates[selectedTrackerId] }
            : filteredTrackerStates;

    if (!sessionKey || sessionKey === 'replace_with_your_session_key') {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <strong>Configuration Error:</strong> Please set a valid <code>NEXT_PUBLIC_NAVIXY_SESSION_KEY</code> in your <code>.env.local</code> file.<br />
                <span className="text-sm mt-2 block">Current region: {activeRegion}</span>
            </div>
        );
    }

    // Geofence Handlers
    const handleStartDrawing = (mode: 'polygon' | 'corridor' | 'circle') => {
        setDrawingMode(mode);
        setDrawnPayload(null);
    };

    const handleDrawComplete = (payload: CreateZonePayload) => {
        setDrawnPayload(payload);
        setDrawingMode('none');
    };

    const handleToggleMonitorZone = (zoneId: number) => {
        setMonitoredZoneIds(prev => {
            if (prev.includes(zoneId)) return prev.filter(id => id !== zoneId);
            return [...prev, zoneId];
        });
    };

    const handleCancelDrawing = () => {
        setDrawingMode('none');
        setDrawnPayload(null);
    };

    const handleGlobalRefresh = async () => {
        setIsRefreshing(true);
        await refreshZones();
        // Artificial delay for feedback
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    // Vehicle selection handler
    const handleSelectVehicle = (trackerId: number) => {
        setSelectedTrackerId(trackerId);
    };

    // Back to vehicle search
    const handleBackToVehicleSearch = () => {
        setSelectedTrackerId(null);
    };

    // Handle fleet region change - this reloads trackers for the new region
    const handleFleetRegionChange = (newRegion: 'TZ' | 'ZM') => {
        setFleetRegion(newRegion);
        setRegion(newRegion);
        setSelectedTrackerId(null); // Clear selection when switching regions
    };

    // =====================================
    // VEHICLE LOCKED MODE RENDER
    // =====================================
    if (isVehicleLocked && selectedTrackerId) {
        const vehicleLabel = trackerLabels[selectedTrackerId] || `Vehicle #${selectedTrackerId}`;

        return (
            <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pt-2 md:pt-4">
                {/* Minimal Header for Locked Vehicle Mode */}
                <div className="flex items-center justify-between mb-2 md:mb-4 pb-2 md:pb-4 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900">Unifleet Monitoring</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeRegion} Operations State</p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={handleGlobalRefresh}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 transition-all shadow-sm flex items-center gap-2"
                            title="Refresh data"
                        >
                            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin text-blue-500")} />
                            <span className="text-[10px] font-bold uppercase">Refresh</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="hidden sm:inline">LIVE SYSTEM ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* Vehicle Panel + Map */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
                    <div className="h-[80vh] lg:h-full overflow-hidden flex flex-col">
                        <VehiclePanel
                            trackerId={selectedTrackerId}
                            trackerState={trackerStates[selectedTrackerId] || null}
                            trackerLabel={vehicleLabel}
                            region={activeRegion}
                            viewMode="locked"
                            zones={zones}
                            onRefresh={handleGlobalRefresh}
                        />
                    </div>
                    <div className="lg:col-span-2 h-[70vh] lg:h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
                        <RealtimeMap
                            trackers={mapTrackers}
                            trackerLabels={trackerLabels}
                            analysis={null}
                            focusedTrackerId={selectedTrackerId}
                            zones={zones}
                            selectedZoneId={null}
                            onSelectZone={() => { }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // =====================================
    // GEOFENCE LOCKED MODE RENDER
    // =====================================
    if (isGeofenceLocked) {
        return (
            <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pt-2 md:pt-4">
                {/* Minimal Header for Locked Mode */}
                <div className="flex items-center justify-between mb-2 md:mb-4 pb-2 md:pb-4 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900">Unifleet Monitoring</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{region} Operations State</p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={handleGlobalRefresh}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 transition-all shadow-sm flex items-center gap-2"
                            title="Refresh data"
                        >
                            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin text-blue-500")} />
                            <span className="text-[10px] font-bold uppercase">Refresh</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="hidden sm:inline">LIVE SYSTEM ACTIVE</span>
                        </div>
                    </div>
                </div>

                {/* Geofence Panel + Map */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
                    <div className="h-[80vh] lg:h-full overflow-hidden flex flex-col">
                        <GeofencePanel
                            zones={zones}
                            selectedZoneId={selectedZoneId}
                            trackerLabels={trackerLabels}
                            onSelectZone={setSelectedZoneId}
                            onCreateZone={createZone}
                            onStartDrawing={handleStartDrawing}
                            onCancelDrawing={handleCancelDrawing}
                            drawnPayload={drawnPayload}
                            monitoredZoneIds={monitoredZoneIds}
                            onMonitorZones={setMonitoredZoneIds}
                            region={region}
                            onRefresh={refreshZones}
                            viewMode="locked"
                        />
                    </div>
                    <div className="lg:col-span-2 h-[70vh] lg:h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
                        <RealtimeMap
                            trackers={filteredTrackerStates}
                            trackerLabels={trackerLabels}
                            analysis={analysis}
                            zones={zones}
                            selectedZoneId={selectedZoneId}
                            onSelectZone={setSelectedZoneId}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // =====================================
    // NORMAL (UNLOCKED) MODE RENDER
    // =====================================
    return (
        <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pt-2 md:pt-4">
            {/* Branding & Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Unifleet Real-time Operations</h1>
                    <p className="text-slate-500 text-sm">Live fleet monitoring and telemetry status</p>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Main Mode Switcher */}
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => {
                                    setMainMode('geofence');
                                    setSelectedTrackerId(null);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all",
                                    mainMode === 'geofence'
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <MapPin size={14} />
                                Live Geofence Monitoring
                            </button>
                            <button
                                onClick={() => {
                                    setMainMode('fleet');
                                    setCurrentView('summary');
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all",
                                    mainMode === 'fleet'
                                        ? "bg-white text-emerald-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Truck size={14} />
                                Live Fleet Monitoring
                            </button>
                        </div>

                        {/* Region Switcher - Only shown in geofence mode */}
                        {mainMode === 'geofence' && (
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button
                                    onClick={() => setRegion('TZ')}
                                    className={cn(
                                        "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                        region === 'TZ'
                                            ? "bg-white text-blue-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    TZ Ops
                                </button>
                                <button
                                    onClick={() => setRegion('ZM')}
                                    className={cn(
                                        "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                        region === 'ZM'
                                            ? "bg-white text-emerald-600 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    ZM Ops
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {loading && <Loader2 className="animate-spin text-blue-500" size={20} />}
                        {!loading && (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleGlobalRefresh}
                                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 transition-all shadow-sm flex items-center gap-2 group"
                                    title="Refresh all data"
                                >
                                    <RefreshCw size={14} className={cn("transition-transform", isRefreshing && "animate-spin text-blue-500")} />
                                    <span className="text-xs font-bold">Refresh</span>
                                </button>
                                <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-green-200 shadow-lg" />
                                    Live System Active
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* =====================================
                GEOFENCE MODE CONTENT
            ===================================== */}
            {mainMode === 'geofence' && (
                <>
                    {/* SUMMARY VIEW: Just Active Geofences + Monitor Geofences */}
                    {currentView === 'summary' && (
                        <RealtimeInsights
                            analysis={analysis}
                            currentView={currentView}
                            onViewChange={setCurrentView}
                            onActionSelect={setFocusedAction}
                            zones={zones}
                            trackerLabels={trackerLabels}
                            monitoredZoneIds={monitoredZoneIds}
                        />
                    )}

                    {/* DRILL DOWN VIEW: Split Screen (Map + Interactive List/Panel) */}
                    {currentView !== 'summary' && (
                        <div className="space-y-4">
                            {/* Back Button Header for Drill Down Views */}
                            {(currentView === 'geofences' || currentView === 'monitor') && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentView('summary')}
                                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 transition-colors shadow-sm"
                                    >
                                        <ArrowLeft size={16} />
                                        <span className="text-sm font-medium">Back to Dashboard</span>
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-280px)] lg:min-h-[500px] animate-in slide-in-from-right duration-300">
                                {/* Left Panel: The Interactive List OR Geofence Panel */}
                                <div className="h-[80vh] lg:h-full overflow-hidden flex flex-col">
                                    {currentView === 'geofences' ? (
                                        <GeofencePanel
                                            zones={zones}
                                            selectedZoneId={selectedZoneId}
                                            trackerLabels={trackerLabels}
                                            onSelectZone={setSelectedZoneId}
                                            onCreateZone={createZone}
                                            onStartDrawing={handleStartDrawing}
                                            onCancelDrawing={handleCancelDrawing}
                                            drawnPayload={drawnPayload}
                                            monitoredZoneIds={monitoredZoneIds}
                                            onMonitorZones={setMonitoredZoneIds}
                                            region={region}
                                            onRefresh={refreshZones}
                                            viewMode="unlocked"
                                        />
                                    ) : (
                                        <RealtimeInsights
                                            analysis={analysis}
                                            currentView={currentView}
                                            onViewChange={setCurrentView}
                                            onActionSelect={setFocusedAction}
                                            zones={zones}
                                            trackerLabels={trackerLabels}
                                            monitoredZoneIds={monitoredZoneIds}
                                            onToggleMonitorZone={handleToggleMonitorZone}
                                            onSelectZone={setSelectedZoneId}
                                        />
                                    )}
                                </div>

                                {/* Right Panel: The Interactive Map */}
                                <div className="lg:col-span-2 h-[70vh] lg:h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
                                    <RealtimeMap
                                        trackers={filteredTrackerStates}
                                        trackerLabels={trackerLabels}
                                        analysis={analysis}
                                        showDelays={currentView === 'traffic'}
                                        focusedAction={focusedAction}
                                        focusedTrackerId={focusedId}
                                        zones={zones}
                                        selectedZoneId={selectedZoneId}
                                        onSelectZone={setSelectedZoneId}
                                        drawingMode={drawingMode}
                                        onDrawComplete={handleDrawComplete}
                                        onDrawCancel={handleCancelDrawing}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* =====================================
                FLEET MODE CONTENT
            ===================================== */}
            {mainMode === 'fleet' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-280px)] lg:min-h-[500px] animate-in slide-in-from-right duration-300">
                    {/* Left Panel: Vehicle Search or Vehicle Detail */}
                    <div className="h-[80vh] lg:h-full overflow-hidden flex flex-col">
                        {selectedTrackerId ? (
                            <VehiclePanel
                                trackerId={selectedTrackerId}
                                trackerState={trackerStates[selectedTrackerId] || null}
                                trackerLabel={trackerLabels[selectedTrackerId] || `Vehicle #${selectedTrackerId}`}
                                region={fleetRegion}
                                viewMode="unlocked"
                                zones={zones}
                                onBack={handleBackToVehicleSearch}
                                onRefresh={handleGlobalRefresh}
                            />
                        ) : (
                            <VehicleSearch
                                trackerLabels={trackerLabels}
                                trackerStates={trackerStates}
                                region={fleetRegion}
                                onRegionChange={handleFleetRegionChange}
                                onSelectVehicle={handleSelectVehicle}
                            />
                        )}
                    </div>

                    {/* Right Panel: The Interactive Map */}
                    <div className="lg:col-span-2 h-[70vh] lg:h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
                        <RealtimeMap
                            trackers={mapTrackers}
                            trackerLabels={trackerLabels}
                            analysis={selectedTrackerId ? null : analysis}
                            focusedTrackerId={selectedTrackerId}
                            zones={zones}
                            selectedZoneId={null}
                            onSelectZone={() => { }}
                        />
                    </div>
                </div>
            )}

            {/* Data Inspector - Hidden in Locked Mode */}
            <NavixyDataInspector trackerStates={trackerStates} trackerLabels={trackerLabels} />
        </div>
    );
}
