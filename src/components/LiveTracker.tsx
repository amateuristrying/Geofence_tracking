'use client';

import React, { useState, useEffect } from 'react';
import { useNavixyRealtime } from '../hooks/useNavixyRealtime';
import { useFleetAnalysis } from '../hooks/useFleetAnalysis';

import { useGeofences } from '../hooks/useGeofences';
import RealtimeMap from './RealtimeMap';
import RealtimeInsights from './RealtimeInsights';
import GeofencePanel from './GeofencePanel';

import NavixyDataInspector from './NavixyDataInspector';
import { Loader2, ArrowLeft } from 'lucide-react';
import { NavixyService } from '../services/navixy';
import { cn } from '@/lib/utils';
import type { CreateZonePayload } from '../types/geofence';
import { CUSTOM_TRACKER_LABELS } from '../config/vehicleDirectory';

export default function LiveTracker() {
    const [trackerIds, setTrackerIds] = useState<number[]>([]);
    const [trackerLabels, setTrackerLabels] = useState<Record<number, string>>({});



    // State for Drill-Down View
    const [currentView, setCurrentView] = useState<'summary' | 'traffic' | 'geofences' | 'monitor'>('summary');
    const [focusedAction, setFocusedAction] = useState<any | null>(null);
    const [focusedId, setFocusedId] = useState<number | null>(null);

    // Geofence Drawing State
    const [drawingMode, setDrawingMode] = useState<'none' | 'polygon' | 'corridor' | 'circle'>('none');
    const [drawnPayload, setDrawnPayload] = useState<CreateZonePayload | null>(null);

    // Monitored Geofences State (user-selected from GeofencePanel)
    const [monitoredZoneIds, setMonitoredZoneIds] = useState<number[]>([]);

    // Region/Ops State
    const [region, setRegion] = useState<'TZ' | 'ZM'>('TZ');

    const sessionKey = region === 'TZ'
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


    // Initialize Geofence Hook
    const {
        zones, selectedZoneId, setSelectedZoneId,
        createZone, deleteZone, refreshZones
    } = useGeofences(trackerStates, sessionKey, trackerIds);

    const trackerList = Object.entries(trackerStates).map(([id, state]) => ({
        id: Number(id),
        state
    }));

    // Get all tracker states for the map
    const filteredTrackerStates = trackerList.reduce((acc, { id, state }) => {
        acc[id] = state;
        return acc;
    }, {} as Record<number, any>);


    if (!sessionKey || sessionKey === 'replace_with_your_session_key') {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <strong>Configuration Error:</strong> Please set a valid <code>NEXT_PUBLIC_NAVIXY_SESSION_KEY</code> in your <code>.env.local</code> file.<br />
                <span className="text-sm mt-2 block">Current region: {region}</span>
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto pt-4">
            {/* Branding & Header */}
            <div className="flex flex-col gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Unifleet Real-time Operations</h1>
                    <p className="text-slate-500 text-sm">Live fleet monitoring and telemetry status</p>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-800">Live Fleet Monitoring</h2>

                        {/* Region Switcher */}
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
                    </div>

                    <div className="flex items-center gap-2">
                        {loading && <Loader2 className="animate-spin text-blue-500" size={20} />}
                        {!loading && <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-green-200 shadow-lg" /> Live System Active</div>}
                    </div>
                </div>
            </div>

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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px] animate-in slide-in-from-right duration-300">
                        {/* Left Panel: The Interactive List OR Geofence Panel */}
                        <div className="h-full overflow-hidden flex flex-col">
                            {currentView === 'geofences' ? (
                                <GeofencePanel
                                    zones={zones}
                                    selectedZoneId={selectedZoneId}
                                    trackerLabels={trackerLabels}
                                    onSelectZone={setSelectedZoneId}
                                    onCreateZone={createZone}
                                    onDeleteZone={deleteZone}
                                    onStartDrawing={handleStartDrawing}
                                    onCancelDrawing={handleCancelDrawing}
                                    drawnPayload={drawnPayload}
                                    monitoredZoneIds={monitoredZoneIds}
                                    onMonitorZones={setMonitoredZoneIds}
                                    region={region}
                                    onRefresh={refreshZones}
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
                        <div className="lg:col-span-2 h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
                            <RealtimeMap
                                trackers={filteredTrackerStates}
                                trackerLabels={trackerLabels}
                                analysis={analysis}
                                showDelays={currentView === 'traffic'} // Show Alerts only in traffic view
                                focusedAction={focusedAction} // Zoom to selection
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

            {/* Data Inspector - Floating Debug Tool */}
            <NavixyDataInspector trackerStates={trackerStates} trackerLabels={trackerLabels} />
        </div>
    );
}
