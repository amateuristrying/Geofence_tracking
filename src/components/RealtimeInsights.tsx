'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    MapPin,
    Anchor,
    Warehouse,
    Files,
    ArrowRight,
    Truck,
    ShieldCheck,
    ArrowLeft,
    Eye,
    X,
    Clock
} from 'lucide-react';
import { FleetAnalysis, ZoneType, ActionItem } from '../hooks/useFleetAnalysis';
import type { Geofence } from '../types/geofence';

// Default monitor geofence names (exact match, case-insensitive)
const DEFAULT_MONITOR_GEOFENCES = ['ndola parking', 'beira loading gf'];

interface RealtimeInsightsProps {
    analysis: FleetAnalysis | null;
    currentView: 'summary' | 'traffic' | 'geofences' | 'monitor';
    onViewChange: (view: 'summary' | 'traffic' | 'geofences' | 'monitor') => void;
    onActionSelect?: (action: ActionItem) => void;
    zones?: Geofence[];
    trackerLabels?: Record<number, string>;
    monitoredZoneIds?: number[]; // User-selected zones from GeofencePanel
    onToggleMonitorZone?: (zoneId: number) => void;
    onSelectZone?: (zoneId: number) => void;
}

// Helper to format duration
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const lowerStatus = status.toLowerCase();
    let bgColor = 'bg-slate-100';
    let textColor = 'text-slate-600';
    let dotColor = 'bg-slate-400';

    if (lowerStatus.includes('moving')) {
        bgColor = 'bg-green-50';
        textColor = 'text-green-700';
        dotColor = 'bg-green-500';
    } else if (lowerStatus.includes('parked')) {
        bgColor = 'bg-blue-50';
        textColor = 'text-blue-700';
        dotColor = 'bg-blue-500';
    } else if (lowerStatus.includes('stopped') || lowerStatus.includes('idle')) {
        bgColor = 'bg-amber-50';
        textColor = 'text-amber-700';
        dotColor = 'bg-amber-500';
    } else if (lowerStatus.includes('offline')) {
        bgColor = 'bg-slate-100';
        textColor = 'text-slate-500';
        dotColor = 'bg-slate-400';
    }

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${bgColor} ${textColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
            {status}
        </span>
    );
}

export default function RealtimeInsights({
    analysis,
    currentView,
    onViewChange,
    onActionSelect,
    zones = [],
    trackerLabels = {},
    monitoredZoneIds = [],
    onToggleMonitorZone,
    onSelectZone
}: RealtimeInsightsProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedMonitorZones, setExpandedMonitorZones] = useState<Set<number>>(new Set());

    // Find the monitored geofences - strictly use user-selection
    const monitoredGeofences = useMemo(() => {
        return zones.filter(zone => monitoredZoneIds.includes(zone.id));
    }, [zones, monitoredZoneIds]);

    // Auto-expand monitored zones when they first appear
    const autoExpandedRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (monitoredGeofences.length === 0) return;

        const newIdsToExpand: number[] = [];
        monitoredGeofences.forEach(z => {
            if (!autoExpandedRef.current.has(z.id)) {
                newIdsToExpand.push(z.id);
                autoExpandedRef.current.add(z.id);
            }
        });

        if (newIdsToExpand.length > 0) {
            setExpandedMonitorZones(prev => {
                const next = new Set(prev);
                newIdsToExpand.forEach(id => next.add(id));
                return next;
            });
        }
    }, [monitoredGeofences]);

    if (!analysis) return (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm animate-pulse mb-6">
            <div className="h-4 bg-slate-100 rounded w-1/3 mb-4"></div>
            <div className="h-20 bg-slate-50 rounded"></div>
        </div>
    );

    const getIcon = (type: ZoneType) => {
        switch (type) {
            case 'port': return <Anchor size={16} className="text-blue-600" />;
            case 'border': return <Files size={16} className="text-amber-600" />;
            case 'warehouse': return <Warehouse size={16} className="text-purple-600" />;
            case 'mining': return <Truck size={16} className="text-slate-600" />;
            default: return <AlertTriangle size={16} className="text-red-500" />;
        }
    };

    const handleActionClick = (item: ActionItem) => {
        setSelectedId(item.id);
        if (onActionSelect) {
            onActionSelect(item);
        }
    };

    const toggleMonitorZone = (zoneId: number) => {
        setExpandedMonitorZones(prev => {
            const next = new Set(prev);
            if (next.has(zoneId)) {
                next.delete(zoneId);
            } else {
                next.add(zoneId);
            }
            return next;
        });
    };

    // Filter actions based on view
    const filteredActions = analysis.actions.filter(a => {
        if (currentView === 'traffic') return true;
        if (currentView === 'geofences') return a.type !== 'road';
        return true;
    });

    // --- SUMMARY VIEW (Dashboard) ---
    if (currentView === 'summary') {
        return (
            <div className="space-y-6">
                {/* Active Geofences Card */}
                <div className="flex justify-center">
                    <div
                        onClick={() => onViewChange('geofences')}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-2xl flex flex-col cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                    >
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MapPin size={14} /> Active Geofences
                        </h3>
                        <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                            {Object.entries(analysis.zoneOccupancy)
                                .sort(([, countA], [, countB]) => countB - countA)
                                .slice(0, 4)
                                .map(([name, count]) => (
                                    <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-2 h-2 shrink-0 rounded-full ${count > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                            <span className="text-sm font-medium text-slate-700 truncate" title={name}>{name}</span>
                                        </div>
                                        <span className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm border border-slate-200 text-slate-600 whitespace-nowrap">
                                            {count} <span className="text-[9px] text-slate-400 font-normal">assets</span>
                                        </span>
                                    </div>
                                ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
                            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                                + Add Custom Zone
                            </span>
                        </div>
                    </div>
                </div>

                {/* Monitor Geofences Card */}
                <div className="flex justify-center">
                    <div
                        onClick={() => onViewChange('monitor')}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-2xl flex flex-col cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                    >
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Eye size={14} /> Monitor Geofences
                        </h3>

                        {/* Geofence Tabs */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {monitoredGeofences.length > 0 ? (
                                monitoredGeofences.map(zone => (
                                    <button
                                        key={zone.id}
                                        onClick={(e) => { e.stopPropagation(); toggleMonitorZone(zone.id); }}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${expandedMonitorZones.has(zone.id)
                                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                                            : 'bg-slate-50 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Eye size={14} className={expandedMonitorZones.has(zone.id) ? 'text-blue-600' : 'text-slate-400'} />
                                            <span className="text-sm font-medium text-slate-700 truncate" title={zone.name}>
                                                {zone.name}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm border border-slate-200 text-slate-600 whitespace-nowrap">
                                            {zone.vehicleCount} <span className="text-[9px] text-slate-400 font-normal">assets</span>
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-2 text-center text-slate-400 text-sm py-4">
                                    No monitor geofences configured. Click Active Geofences to add zones.
                                </div>
                            )}
                        </div>

                        {/* Expanded Panels - Side by Side */}
                        {expandedMonitorZones.size > 0 && (
                            <div className={`grid gap-4 ${expandedMonitorZones.size === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {monitoredGeofences
                                    .filter(zone => expandedMonitorZones.has(zone.id))
                                    .map(zone => (
                                        <div
                                            key={zone.id}
                                            className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 duration-200"
                                        >
                                            {/* Panel Header */}
                                            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                    <span className="font-bold text-sm text-slate-800">{zone.name}</span>
                                                    <span className="text-xs text-slate-500">({zone.vehicleCount} vehicles)</span>
                                                </div>
                                                <button
                                                    onClick={() => toggleMonitorZone(zone.id)}
                                                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                                                >
                                                    <X size={14} className="text-slate-500" />
                                                </button>
                                            </div>

                                            {/* Vehicle List */}
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                {zone.vehicleIds.length > 0 ? (
                                                    <div className="divide-y divide-slate-100">
                                                        {zone.vehicleIds.map(vehicleId => {
                                                            const occupant = zone.occupants[vehicleId];
                                                            const vehicleName = trackerLabels[vehicleId] || `Vehicle #${vehicleId}`;
                                                            const dwellTime = occupant
                                                                ? formatDuration(Date.now() - occupant.entryTime)
                                                                : '--';

                                                            return (
                                                                <div
                                                                    key={vehicleId}
                                                                    className="px-4 py-3 hover:bg-white transition-colors"
                                                                >
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-medium text-sm text-slate-800 truncate" title={vehicleName}>
                                                                            {vehicleName}
                                                                        </span>
                                                                        <StatusBadge status={occupant?.status || 'Unknown'} />
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                                        <Clock size={10} />
                                                                        <span>In zone: {dwellTime}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                                        No vehicles in this geofence
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}


                    </div>
                </div>
            </div>
        );
    }

    // --- MONITOR DETAILED VIEW ---
    if (currentView === 'monitor') {
        return (
            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden order-1 lg:order-2">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-slate-50">
                    <button
                        onClick={() => onViewChange('summary')}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 leading-tight">Monitored Zones</h2>
                        <p className="text-xs text-slate-500">{monitoredGeofences.length} zones selected</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 custom-scrollbar">
                    {monitoredGeofences.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white rounded-lg border border-dashed border-gray-200 h-64">
                            <Eye className="text-slate-300 mb-4" size={40} />
                            <p className="text-sm font-medium text-slate-500 mb-4 max-w-xs leading-relaxed">
                                Go to Active Geofences Section to select what vehicles you want to Monitor here.
                            </p>
                            <button
                                onClick={() => onViewChange('geofences')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
                            >
                                Active Geofences <ArrowRight size={14} />
                            </button>
                        </div>
                    ) : (
                        monitoredGeofences.map(zone => {
                            // Get vehicles directly from zone.occupants
                            const occupantsList = Object.values(zone.occupants || {});

                            return (
                                <div
                                    key={zone.id}
                                    onClick={() => onSelectZone?.(zone.id)}
                                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                                >
                                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-transparent relative">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                                                <MapPin size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">{zone.name}</h3>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Geofence Monitor</p>
                                            </div>
                                        </div>
                                        <div className="pr-2">
                                            <div className="flex flex-col items-end mr-6">
                                                <span className="text-lg font-bold text-slate-900 leading-none">{occupantsList.length}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase">Active Assets</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onToggleMonitorZone?.(zone.id); }}
                                                className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                title="Remove from monitor"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        {/* Vehicle List */}
                                        <div className="mb-6">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Current Assets</h4>
                                            {occupantsList.length > 0 ? (
                                                <div className="space-y-2">
                                                    {occupantsList.map(occ => {
                                                        const duration = Date.now() - occ.entryTime;
                                                        const durationStr = formatDuration(duration);
                                                        const label = trackerLabels?.[occ.trackerId] || `Vehicle #${occ.trackerId}`;
                                                        const entryTimeStr = new Date(occ.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                                        return (
                                                            <div key={occ.trackerId} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${occ.status.toLowerCase().includes('moving') ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-slate-700">{label}</div>
                                                                        <div className="text-[10px] text-slate-400">{occ.status}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                                                        In zone: {durationStr}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                                        Entry: {entryTimeStr}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-slate-400 italic py-2">No vehicles currently in zone</div>
                                            )}
                                        </div>

                                        {/* Recent Exits Section (Placeholder) */}
                                        <div className="pt-4 border-t border-dashed border-slate-200">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                <Clock size={14} /> Recent Exits
                                            </h4>
                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                                                <p className="text-xs text-slate-400">Recent exits capability currently disabled for stability.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // --- DETAILED VIEW (Drill Down) ---
    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden order-1 lg:order-2">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-slate-50">
                <button
                    onClick={() => {
                        setSelectedId(null);
                        onViewChange('summary');
                    }}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600 transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                        {currentView === 'traffic' ? 'Traffic Analysis' : 'Geofence Ops'}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {filteredActions.length} Active Items
                    </p>
                </div>
            </div>

            {/* Scrollable List Container */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50/50">
                {filteredActions.length === 0 ? (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-6 text-center">
                        <div className="inline-flex bg-white p-2 rounded-full shadow-sm mb-2">
                            <ShieldCheck className="text-green-500" size={20} />
                        </div>
                        <h4 className="font-bold text-green-800 text-sm">No Critical Issues</h4>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredActions.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleActionClick(item)}
                                className={`
                                    bg-white rounded-lg border p-3 shadow-sm transition-all cursor-pointer relative overflow-hidden
                                    ${selectedId === item.id
                                        ? 'ring-2 ring-blue-500 border-blue-500'
                                        : 'hover:border-blue-300 hover:shadow-md'
                                    }
                                    ${item.severity === 'high' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-400'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-md ${item.severity === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                                            {getIcon(item.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 text-xs leading-tight truncate pr-2" title={item.title}>{item.title}</h4>
                                            <p className="text-[10px] text-slate-500 truncate" title={item.location}>{item.location}</p>
                                        </div>
                                    </div>
                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                                        {item.count} Assets
                                    </span>
                                </div>

                                <div className="pl-9">
                                    <p className="text-[10px] text-slate-600 font-medium bg-slate-50 p-1.5 rounded border border-slate-100 leading-snug">
                                        {item.action}
                                    </p>
                                    <div className="flex items-center gap-1 text-[9px] text-blue-600 font-bold mt-1.5 uppercase tracking-wide opacity-80 group-hover:opacity-100">
                                        Zoom to Zone <ArrowRight size={8} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
