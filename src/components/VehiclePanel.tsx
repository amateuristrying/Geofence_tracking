'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft, RefreshCw, Truck, MapPin, Gauge, Compass,
    Clock, Power, Wifi, WifiOff, Navigation, Hexagon
} from 'lucide-react';
import { NavixyTrackerState } from '../services/navixy';
import { getVehicleStatus } from '../hooks/useTrackerStatusDuration';
import { parseNavixyDate } from '@/lib/utils';
import type { Geofence } from '../types/geofence';
import * as turf from '@turf/turf';

interface VehiclePanelProps {
    trackerId: number;
    trackerState: NavixyTrackerState | null;
    trackerLabel: string;
    region: 'TZ' | 'ZM';
    viewMode: 'locked' | 'unlocked';
    zones?: Geofence[];
    onBack?: () => void;
    onRefresh?: () => void;
}

// Helper to get heading direction
function getHeadingDirection(heading: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
}

// Helper to format time ago
function formatTimeAgo(dateString: string): string {
    try {
        const date = parseNavixyDate(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ${diffHours % 24}h ago`;
    } catch {
        return 'Unknown';
    }
}

// Helper to check if vehicle is inside a geofence
function findCurrentGeofence(lat: number, lng: number, zones: Geofence[]): Geofence | null {
    if (!lat || !lng || zones.length === 0) return null;

    const point = turf.point([lng, lat]);

    for (const zone of zones) {
        if (zone.type === 'circle' && zone.center && zone.radius) {
            const center = turf.point([zone.center.lng, zone.center.lat]);
            const distance = turf.distance(point, center, { units: 'meters' });
            if (distance <= zone.radius) {
                return zone;
            }
        } else if ((zone.type === 'polygon' || zone.type === 'sausage' || zone.type === 'corridor') && zone.points && zone.points.length >= 3) {
            try {
                const coords = zone.points.map(p => [p.lng, p.lat]);
                // Close the polygon
                if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                    coords.push(coords[0]);
                }
                const polygon = turf.polygon([coords]);
                if (turf.booleanPointInPolygon(point, polygon)) {
                    return zone;
                }
            } catch {
                // Invalid polygon, skip
            }
        }
    }
    return null;
}

export default function VehiclePanel({
    trackerId,
    trackerState,
    trackerLabel,
    region,
    viewMode,
    zones = [],
    onBack,
    onRefresh
}: VehiclePanelProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [, setTick] = useState(0);

    // Force re-render every minute for time updates
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const handleRefresh = async () => {
        if (onRefresh) {
            setIsRefreshing(true);
            await onRefresh();
            setTimeout(() => setIsRefreshing(false), 1000);
        }
    };

    // Derive vehicle data
    const status = trackerState ? getVehicleStatus(trackerState) : 'offline';
    const speed = trackerState?.gps?.speed || 0;
    const heading = trackerState?.gps?.heading || 0;
    const lat = trackerState?.gps?.location?.lat || 0;
    const lng = trackerState?.gps?.location?.lng || 0;
    const lastUpdate = trackerState?.last_update || '';
    const ignition = trackerState?.ignition;
    const connectionStatus = trackerState?.connection_status || 'offline';

    // Find current geofence
    const currentGeofence = useMemo(() => {
        return findCurrentGeofence(lat, lng, zones);
    }, [lat, lng, zones]);

    // Status styling
    const getStatusStyle = (s: string) => {
        switch (s) {
            case 'moving':
                return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
            case 'stopped':
                return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
            case 'parked':
                return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
            case 'idle-stopped':
            case 'idle-parked':
                return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
            default:
                return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' };
        }
    };

    const statusStyle = getStatusStyle(status);

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
                {viewMode === 'unlocked' && onBack && (
                    <button
                        onClick={onBack}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600 transition-all"
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">{trackerLabel} - Live</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Real-time vehicle tracking</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-slate-600 transition-all shadow-sm"
                    title="Refresh data"
                >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status Badge */}
                <div className={`rounded-xl p-4 ${statusStyle.bg} border ${statusStyle.border}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Truck size={24} className={statusStyle.text} />
                            <div>
                                <p className={`text-lg font-black ${statusStyle.text} capitalize`}>
                                    {status.replace('-', ' ')}
                                </p>
                                <p className="text-xs text-slate-500">Vehicle Status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {connectionStatus === 'active' ? (
                                <div className="flex items-center gap-1 text-green-600">
                                    <Wifi size={14} />
                                    <span className="text-[10px] font-bold">ONLINE</span>
                                </div>
                            ) : connectionStatus === 'idle' ? (
                                <div className="flex items-center gap-1 text-amber-600">
                                    <Wifi size={14} />
                                    <span className="text-[10px] font-bold">IDLE</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-slate-400">
                                    <WifiOff size={14} />
                                    <span className="text-[10px] font-bold">OFFLINE</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Current Geofence */}
                <div className={`rounded-xl p-4 border ${currentGeofence ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <Hexagon size={20} className={currentGeofence ? 'text-indigo-600' : 'text-slate-400'} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Current Geofence</p>
                            {currentGeofence ? (
                                <p className="text-sm font-bold text-indigo-700 truncate">{currentGeofence.name}</p>
                            ) : (
                                <p className="text-sm font-medium text-slate-500">Not in any geofence</p>
                            )}
                        </div>
                        {currentGeofence && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentGeofence.color }}></div>
                        )}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Speed */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Gauge size={14} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Speed</span>
                        </div>
                        <p className="text-2xl font-black text-slate-800">
                            {Math.round(speed)} <span className="text-sm font-medium text-slate-400">km/h</span>
                        </p>
                    </div>

                    {/* Heading */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Compass size={14} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Heading</span>
                        </div>
                        <p className="text-2xl font-black text-slate-800">
                            {getHeadingDirection(heading)} <span className="text-sm font-medium text-slate-400">{Math.round(heading)}°</span>
                        </p>
                    </div>

                    {/* Last Update */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Last Update</span>
                        </div>
                        <p className="text-lg font-bold text-slate-800">
                            {formatTimeAgo(lastUpdate)}
                        </p>
                    </div>

                    {/* Ignition */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Power size={14} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Ignition</span>
                        </div>
                        <p className={`text-lg font-bold ${ignition ? 'text-green-600' : 'text-slate-400'}`}>
                            {ignition === undefined ? '--' : ignition ? 'ON' : 'OFF'}
                        </p>
                    </div>
                </div>

                {/* Coordinates */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Navigation size={14} className="text-slate-400" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Coordinates</span>
                    </div>
                    <p className="text-sm font-mono text-slate-700">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                    <a
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline mt-1 inline-block"
                    >
                        Open in Google Maps ↗
                    </a>
                </div>

                {/* WhatsApp Share - Only in Unlocked Mode */}
                {viewMode === 'unlocked' && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <h3 className="text-[10px] items-center gap-1.5 flex font-bold text-emerald-700 uppercase tracking-wider mb-2">
                            Share Live Tracking
                        </h3>
                        <p className="text-xs text-emerald-600 mb-4 leading-relaxed">
                            Generate a permanent read-only link to share real-time vehicle tracking with external partners via WhatsApp.
                        </p>
                        <button
                            onClick={() => {
                                try {
                                    const baseUrl = window.location.origin + window.location.pathname;
                                    const shareUrl = `${baseUrl}?tracker_id=${trackerId}&view=locked&region=${region}`;

                                    const message = `Live Vehicle Tracking – ${trackerLabel}\nReal-time shipment monitoring\n\n${shareUrl}`;
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
                )}
            </div>
        </div>
    );
}
