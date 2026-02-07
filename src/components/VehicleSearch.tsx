'use client';

import React, { useState, useMemo } from 'react';
import { Search, Truck, MapPin, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { NavixyTrackerState } from '../services/navixy';
import { getVehicleStatus } from '../hooks/useTrackerStatusDuration';

interface VehicleSearchProps {
    trackerLabels: Record<number, string>;
    trackerStates: Record<number, NavixyTrackerState>;
    region: 'TZ' | 'ZM';
    onRegionChange: (region: 'TZ' | 'ZM') => void;
    onSelectVehicle: (trackerId: number) => void;
}

export default function VehicleSearch({
    trackerLabels,
    trackerStates,
    region,
    onRegionChange,
    onSelectVehicle
}: VehicleSearchProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Get total count of trackers
    const totalTrackers = Object.keys(trackerLabels).length;

    // Filter vehicles based on search query
    const searchResults = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return [];

        return Object.entries(trackerLabels)
            .filter(([id, label]) => label.toLowerCase().includes(q))
            .slice(0, 15) // Limit to 15 results
            .map(([id, label]) => {
                const trackerId = Number(id);
                const state = trackerStates[trackerId];
                const status = state ? getVehicleStatus(state) : 'offline';
                const speed = state?.gps?.speed || 0;

                return {
                    id: trackerId,
                    label,
                    status,
                    speed,
                    isOnline: state?.connection_status !== 'offline'
                };
            });
    }, [searchQuery, trackerLabels, trackerStates]);

    // Get status styling
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'moving':
                return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
            case 'stopped':
                return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
            case 'parked':
                return { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };
            case 'idle-stopped':
            case 'idle-parked':
                return { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' };
            default:
                return { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                    <Truck size={18} className="text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900">Live Fleet Monitoring</h2>
                </div>

                {/* Region Toggle */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 mb-4">
                    <button
                        onClick={() => onRegionChange('TZ')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${region === 'TZ'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        TZ Ops
                    </button>
                    <button
                        onClick={() => onRegionChange('ZM')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${region === 'ZM'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        ZM Ops
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search vehicle... e.g., 2234 or DRF"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
                        autoFocus
                    />
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-3">
                {searchQuery.trim() === '' ? (
                    // Empty state - no search yet
                    <div className="text-center py-12">
                        <Search className="mx-auto text-slate-300 mb-3" size={32} />
                        <p className="text-sm font-medium text-slate-500">Search for a vehicle</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {totalTrackers} vehicles in {region} operations
                        </p>
                        <p className="text-[10px] text-slate-300 mt-4">
                            Type vehicle number or name to find it
                        </p>
                    </div>
                ) : searchResults.length === 0 ? (
                    // No results
                    <div className="text-center py-12">
                        <Truck className="mx-auto text-slate-300 mb-3" size={32} />
                        <p className="text-sm font-medium text-slate-500">No vehicles found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Try a different search term
                        </p>
                    </div>
                ) : (
                    // Search results
                    <div className="space-y-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1 mb-3">
                            {searchResults.length} vehicle{searchResults.length !== 1 ? 's' : ''} found
                        </p>
                        {searchResults.map((vehicle) => {
                            const statusStyle = getStatusStyle(vehicle.status);
                            return (
                                <button
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle.id)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Status dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot} ${vehicle.status === 'moving' ? 'animate-pulse' : ''}`}></div>

                                        {/* Vehicle info */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700">
                                                {vehicle.label}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text} font-medium capitalize`}>
                                                    {vehicle.status.replace('-', ' ')}
                                                </span>
                                                {vehicle.status === 'moving' && (
                                                    <span className="text-[10px] text-slate-400">
                                                        {Math.round(vehicle.speed)} km/h
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Connection status + Arrow */}
                                    <div className="flex items-center gap-2">
                                        {vehicle.isOnline ? (
                                            <Wifi size={12} className="text-green-500" />
                                        ) : (
                                            <WifiOff size={12} className="text-slate-300" />
                                        )}
                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-slate-50/50">
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                    <MapPin size={10} />
                    <span>Select a vehicle to view live tracking and share</span>
                </div>
            </div>
        </div>
    );
}
