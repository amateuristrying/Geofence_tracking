'use client';

import React, { useState } from 'react';
import {
    MapPin, Plus, Trash2, Clock, ArrowLeft,
    Anchor, Files, Warehouse, Truck, Target,
    Hexagon, Route, Circle,
    Eye, Check, X, Square
} from 'lucide-react';
import type { Geofence, CreateZonePayload, GeofenceCategory } from '../types/geofence';

type PanelView = 'list' | 'create' | 'detail';

interface GeofencePanelProps {
    zones: Geofence[];
    selectedZoneId: number | null;

    trackerLabels: Record<number, string>;
    onSelectZone: (zoneId: number | null) => void;
    onCreateZone: (payload: CreateZonePayload) => Promise<number | null>;
    onDeleteZone: (zoneId: number) => Promise<boolean>;
    onStartDrawing: (mode: 'polygon' | 'corridor' | 'circle') => void;
    onCancelDrawing: () => void;
    drawnPayload?: CreateZonePayload | null;

    // Monitor functionality
    monitoredZoneIds?: number[];
    onMonitorZones?: (zoneIds: number[]) => void;

    // Sharing
    region?: 'TZ' | 'ZM';
    onRefresh?: () => void;
}

const categoryIcons: Record<GeofenceCategory, React.ReactNode> = {
    port: <Anchor size={14} className="text-blue-600" />,
    border: <Files size={14} className="text-amber-600" />,
    warehouse: <Warehouse size={14} className="text-purple-600" />,
    mining: <Truck size={14} className="text-slate-600" />,
    depot: <Target size={14} className="text-emerald-600" />,
    custom: <MapPin size={14} className="text-sky-600" />,
};

const categoryLabels: Record<GeofenceCategory, string> = {
    port: 'Port / Terminal',
    border: 'Border / Customs',
    warehouse: 'Warehouse / Hub',
    mining: 'Mining Site',
    depot: 'Depot',
    custom: 'Custom Zone',
};

const MAX_MONITOR_ZONES = 3;

export default function GeofencePanel({
    zones, selectedZoneId, trackerLabels,
    onSelectZone, onCreateZone, onDeleteZone, onStartDrawing, onCancelDrawing,
    drawnPayload, monitoredZoneIds = [], onMonitorZones,
    region = 'TZ', onRefresh
}: GeofencePanelProps) {
    const [view, setView] = useState<PanelView>('list');
    const [createForm, setCreateForm] = useState({
        name: '',
        category: 'custom' as GeofenceCategory,
        type: 'polygon' as 'polygon' | 'corridor' | 'circle',
        radius: 1000, // default meter
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showVehicleToast, setShowVehicleToast] = useState(false);

    // Selection for monitoring - always available
    const [selectedForMonitor, setSelectedForMonitor] = useState<Set<number>>(new Set());

    // Force re-render every minute for duration updates
    const [, setTick] = useState(0);
    React.useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const selectedZone = zones.find(z => z.id === selectedZoneId);

    React.useEffect(() => {
        if (selectedZoneId && view === 'list') {
            setView('detail');
        }
    }, [selectedZoneId]);

    // Handle checkbox toggle (for monitoring selection)
    const handleCheckboxToggle = (e: React.MouseEvent, zoneId: number) => {
        e.stopPropagation(); // Prevent triggering the row click
        setSelectedForMonitor(prev => {
            const next = new Set(prev);
            if (next.has(zoneId)) {
                next.delete(zoneId);
            } else if (next.size < MAX_MONITOR_ZONES) {
                next.add(zoneId);
            }
            return next;
        });
    };

    // Handle row click (for viewing details)
    const handleZoneClick = (zoneId: number) => {
        onSelectZone(zoneId);
        setView('detail');
    };

    const handleDelete = async (zoneId: number) => {
        setDeleting(true);
        await onDeleteZone(zoneId);
        setDeleting(false);
        setView('list');
    };

    const handleStartDraw = () => {
        onStartDrawing(createForm.type);
    };

    const handleSaveZone = async () => {
        if (!createForm.name.trim()) return;
        setSaving(true);

        let payload: CreateZonePayload;
        if (drawnPayload) {
            payload = { ...drawnPayload, label: createForm.name.trim(), category: createForm.category, color: '#3b82f6' };
        } else if (createForm.type === 'circle') {
            setSaving(false);
            return;
        } else {
            setSaving(false);
            return;
        }

        await onCreateZone(payload);
        setSaving(false);
        setCreateForm({ name: '', category: 'custom', type: 'polygon', radius: 500 });
        onCancelDrawing();
        setView('list');
    };

    const handleClearSelection = () => {
        setSelectedForMonitor(new Set());
    };

    const handleConfirmMonitorSelection = () => {
        if (onMonitorZones && selectedForMonitor.size > 0) {
            onMonitorZones(Array.from(selectedForMonitor));
        }
        setSelectedForMonitor(new Set());
    };

    // LIST VIEW
    if (view === 'list') {
        const hasSelections = selectedForMonitor.size > 0;
        // Sort zones by vehicle count descending
        const sortedZones = [...zones].sort((a, b) => b.vehicleCount - a.vehicleCount);

        return (
            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Geofence Zones</h2>
                        <p className="text-xs text-slate-500">
                            {hasSelections
                                ? `${selectedForMonitor.size} of ${MAX_MONITOR_ZONES} zones selected for monitoring`
                                : `${zones.length} zones configured`
                            }
                        </p>
                    </div>

                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {sortedZones.length === 0 ? (
                        <div className="text-center py-12">
                            <MapPin className="mx-auto text-slate-300 mb-3" size={32} />
                            <p className="text-sm font-medium text-slate-500">No geofence zones</p>
                            <p className="text-xs text-slate-400 mt-1">Create your first zone to start monitoring</p>
                            <button
                                onClick={() => setView('create')}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                            >
                                <Plus size={12} className="inline mr-1" /> Create Zone
                            </button>
                        </div>
                    ) : (
                        sortedZones.map(zone => {
                            const isSelectedForMonitor = selectedForMonitor.has(zone.id);
                            const isMonitored = monitoredZoneIds.includes(zone.id);

                            return (
                                <div
                                    key={zone.id}
                                    className={`p-3 rounded-lg border transition-all ${selectedZoneId === zone.id
                                        ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/50'
                                        : isSelectedForMonitor
                                            ? 'ring-2 ring-green-500 border-green-400 bg-green-50/50'
                                            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        {/* Left side: Checkbox + Zone info */}
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Checkbox for monitoring selection */}
                                            <button
                                                onClick={(e) => handleCheckboxToggle(e, zone.id)}
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isSelectedForMonitor
                                                    ? 'bg-green-500 border-green-500 hover:bg-green-600'
                                                    : 'border-slate-300 bg-white hover:border-green-400 hover:bg-green-50'
                                                    } ${selectedForMonitor.size >= MAX_MONITOR_ZONES && !isSelectedForMonitor ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={selectedForMonitor.size >= MAX_MONITOR_ZONES && !isSelectedForMonitor}
                                                title={isSelectedForMonitor ? 'Remove from monitoring' : 'Add to monitoring'}
                                            >
                                                {isSelectedForMonitor && <Check size={12} className="text-white" />}
                                            </button>

                                            {/* Zone color dot */}
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: zone.color }}></div>

                                            {/* Zone details - clickable for detail view */}
                                            <div
                                                className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => handleZoneClick(zone.id)}
                                            >
                                                {categoryIcons[zone.category]}
                                                <span className="text-sm font-medium text-slate-800 truncate">{zone.name}</span>
                                                {isMonitored && (
                                                    <span title="Currently monitored">
                                                        <Eye size={12} className="text-blue-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right side: Type + Count */}
                                        <div
                                            className="flex items-center gap-2 shrink-0 cursor-pointer"
                                            onClick={() => handleZoneClick(zone.id)}
                                        >
                                            <span className="text-[10px] uppercase text-slate-400 font-medium">
                                                {zone.type === 'sausage' ? 'corridor' : zone.type}
                                            </span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${zone.vehicleCount > 0
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {zone.vehicleCount}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer with Monitor button - Always visible */}
                <div className="p-3 border-t border-gray-100 bg-white">
                    {hasSelections ? (
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearSelection}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <X size={12} /> Clear
                            </button>
                            <button
                                onClick={handleConfirmMonitorSelection}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <Eye size={12} /> + Monitor ({selectedForMonitor.size})
                            </button>
                        </div>
                    ) : (
                        <div className="text-center text-xs text-slate-400 py-1">
                            <Eye size={14} className="inline mr-1 opacity-50" />
                            Select zones using checkboxes to monitor them
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // CREATE VIEW
    if (view === 'create') {
        return (
            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
                    <button
                        onClick={() => { setView('list'); onCancelDrawing(); }}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Create Geofence</h2>
                        <p className="text-xs text-slate-500">Draw a zone on the map</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Zone Name</label>
                        <input
                            type="text"
                            value={createForm.name}
                            onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Dar es Salaam Port Terminal"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Category</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(categoryLabels) as GeofenceCategory[]).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCreateForm(prev => ({ ...prev, category: cat }))}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${createForm.category === cat
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-slate-600 hover:border-blue-300'
                                        }`}
                                >
                                    {categoryIcons[cat]}
                                    {categoryLabels[cat]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Zone Shape</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'polygon' as const, label: 'Polygon', icon: <Hexagon size={14} /> },
                                { value: 'corridor' as const, label: 'Corridor', icon: <Route size={14} /> },
                                { value: 'circle' as const, label: 'Circle', icon: <Circle size={14} /> },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setCreateForm(prev => ({ ...prev, type: opt.value }))}
                                    className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${createForm.type === opt.value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-slate-600 hover:border-blue-300'
                                        }`}
                                >
                                    {opt.icon}
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(createForm.type === 'circle' || createForm.type === 'corridor') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                {createForm.type === 'circle' ? 'Radius' : 'Corridor Width'} (meters)
                            </label>
                            <input
                                type="number"
                                value={createForm.radius}
                                onChange={e => setCreateForm(prev => ({ ...prev, radius: Number(e.target.value) }))}
                                min={50}
                                max={50000}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {!drawnPayload ? (
                        <button
                            onClick={handleStartDraw}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 transition-colors"
                        >
                            <MapPin size={16} /> Draw on Map
                        </button>
                    ) : (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                            <p className="text-xs font-bold text-green-700">Zone drawn on map</p>
                            <p className="text-[10px] text-green-600 mt-0.5">
                                {drawnPayload.type === 'polygon' && drawnPayload.points && `${drawnPayload.points.length} points`}
                                {(drawnPayload.type === 'sausage' || drawnPayload.type === 'corridor') && drawnPayload.points && `${drawnPayload.points.length} waypoints`}
                                {drawnPayload.type === 'circle' && `${drawnPayload.radius}m radius`}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleSaveZone}
                        disabled={!createForm.name.trim() || !drawnPayload || saving}
                        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Geofence to Navixy'}
                    </button>
                </div>
            </div>
        );
    }

    // DETAIL VIEW
    if (view === 'detail' && selectedZone) {
        return (
            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
                    <button
                        onClick={() => { setView('list'); onSelectZone(null); }}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 truncate">{selectedZone.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            {categoryIcons[selectedZone.category]}
                            <span className="text-xs text-slate-500">
                                {categoryLabels[selectedZone.category]} &middot; {selectedZone.type === 'sausage' ? 'Corridor' : selectedZone.type}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                            <div className="text-2xl font-black text-blue-700">{selectedZone.vehicleCount}</div>
                            <div className="text-[10px] text-blue-500 font-bold uppercase">Vehicles Inside</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                            <div className="text-2xl font-black text-slate-700">
                                {selectedZone.radius ? `${(selectedZone.radius / 1000).toFixed(1)}km` : '--'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">
                                {selectedZone.type === 'sausage' ? 'Width' : 'Radius'}
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Share Action */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <h3 className="text-[10px] items-center gap-1.5 flex font-bold text-emerald-700 uppercase tracking-wider mb-2">
                            Share Live Dashboard
                        </h3>
                        <p className="text-xs text-emerald-600 mb-4 leading-relaxed">
                            Generate a permanent read-only link to share real-time tracking with external partners via WhatsApp.
                        </p>
                        <button
                            onClick={async () => {
                                try {
                                    let token = selectedZone.share_token;
                                    if (!token) {
                                        const res = await fetch('/api/share/token', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                zoneId: selectedZone.id,
                                                region: region,
                                                metadata: {
                                                    name: selectedZone.name,
                                                    type: selectedZone.type,
                                                    color: selectedZone.color,
                                                    points: selectedZone.points,
                                                    center: selectedZone.center,
                                                    radius: selectedZone.radius
                                                }
                                            }),
                                        });
                                        const data = await res.json();
                                        token = data.token;
                                        if (onRefresh) onRefresh();
                                    }

                                    const shareUrl = `${window.location.origin}/share/geofence/${token}`;
                                    const message = `Live Geofence View – ${selectedZone.name}\nReal-time vehicle tracking\n\n${shareUrl}`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                } catch (err) {
                                    console.error('Share error:', err);
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                        >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Share to WhatsApp
                        </button>
                    </div>

                    {selectedZone.vehicleIds.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-600 mb-2">Vehicles Currently Inside</h3>
                            <div className="space-y-1">
                                {selectedZone.vehicleIds.map(tId => {
                                    const occupant = selectedZone.occupants?.[tId];
                                    const now = Date.now();
                                    const durationMs = occupant ? now - occupant.entryTime : 0;

                                    // Helper for formatting
                                    const formatDwellTime = (ms: number) => {
                                        if (ms < 60000) return 'Just now';
                                        const totalMins = Math.floor(ms / 60000);
                                        const totalHrs = Math.floor(totalMins / 60);
                                        const totalDays = Math.floor(totalHrs / 24);

                                        if (totalDays >= 365) {
                                            const y = Math.floor(totalDays / 365);
                                            const remDays = totalDays % 365;
                                            const mo = Math.floor(remDays / 30);
                                            const d = remDays % 30;
                                            return `${y}y ${mo}mo ${d}d`;
                                        }
                                        if (totalDays >= 30) {
                                            const mo = Math.floor(totalDays / 30);
                                            const d = totalDays % 30;
                                            return `${mo}mo ${d}d`;
                                        }
                                        if (totalDays >= 1) {
                                            const h = totalHrs % 24;
                                            return `${totalDays}d ${h}h`;
                                        }
                                        if (totalHrs > 0) {
                                            return `${totalHrs}h ${totalMins % 60}m`;
                                        }
                                        return `${totalMins}m`;
                                    };

                                    const durationStr = formatDwellTime(durationMs);

                                    // Severity color
                                    let dotColor = 'bg-blue-500';
                                    let timerColor = 'text-slate-400';

                                    if (durationMs > 4 * 60 * 60 * 1000) { // > 4 hours
                                        dotColor = 'bg-red-500';
                                        timerColor = 'text-red-500';
                                    } else if (durationMs > 1 * 60 * 60 * 1000) { // > 1 hour
                                        dotColor = 'bg-amber-500';
                                        timerColor = 'text-amber-600';
                                    }

                                    return (
                                        <div
                                            key={tId}
                                            onClick={() => { setShowVehicleToast(true); setTimeout(() => setShowVehicleToast(false), 4000); }}
                                            className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors relative"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${dotColor} ${durationMs < 60000 ? 'animate-pulse' : ''}`}></div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-700">
                                                        {trackerLabels[tId] || `Tracker #${tId}`}
                                                    </span>
                                                    {occupant?.status && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {occupant.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock size={10} className={timerColor} />
                                                <span className={`text-[10px] font-bold ${timerColor}`}>
                                                    {durationStr}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={() => handleDelete(selectedZone.id)}
                        disabled={deleting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                        <Trash2 size={12} /> {deleting ? 'Deleting...' : 'Delete Zone from Navixy'}
                    </button>
                </div>

                {showVehicleToast && (
                    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2 rounded-lg shadow-lg z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                        You can see vehicle details in geofence monitor
                    </div>
                )}
            </div>
        );
    }

    return null;
}
