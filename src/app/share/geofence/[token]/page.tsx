'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Clock, MapPin } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';

interface TrackerData {
    id: number;
    label: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    last_update: string;
    status: string;
    ignition: boolean;
}

interface GeofenceMetadata {
    id: number;
    name: string;
    type: string;
    color: string;
    points?: { lat: number; lng: number }[];
    center?: { lat: number; lng: number };
    radius?: number;
}

export default function SharedGeofencePage() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<GeofenceMetadata | null>(null);
    const [trackers, setTrackers] = useState<TrackerData[]>([]);

    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Record<number, mapboxgl.Marker>>({});

    // 1. Fetch metadata on load
    useEffect(() => {
        async function fetchMetadata() {
            try {
                const res = await fetch(`/api/share/resolve?token=${token}`);
                if (!res.ok) throw new Error('Failed to resolve share link');
                const data = await res.json();
                setMetadata(data.zone);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchMetadata();
    }, [token]);

    // 2. Poll for live data
    useEffect(() => {
        if (!metadata) return;

        async function fetchLive() {
            try {
                const res = await fetch(`/api/share/live?token=${token}`);
                if (!res.ok) return;
                const data = await res.json();
                setTrackers(data.trackers);
            } catch (err) {
                console.error('Polling error:', err);
            }
        }

        fetchLive();
        const interval = setInterval(fetchLive, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [metadata, token]);

    // 3. Initialize Map
    useEffect(() => {
        if (!mapContainer.current || !metadata || map.current) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

        const m = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: metadata.center ? [metadata.center.lng, metadata.center.lat] : [0, 0],
            zoom: 14,
            attributionControl: false
        });

        m.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

        m.on('load', () => {
            // Add Geofence Source & Layer
            let geojson: any;
            if (metadata.type === 'circle' && metadata.center && metadata.radius) {
                geojson = turf.circle([metadata.center.lng, metadata.center.lat], metadata.radius / 1000, { units: 'kilometers' });
            } else if (metadata.type === 'polygon' && metadata.points) {
                const coords = metadata.points.map(p => [p.lng, p.lat]);
                coords.push(coords[0]);
                geojson = turf.polygon([coords]);
            } else if (metadata.type === 'sausage' && metadata.points && metadata.radius) {
                const line = turf.lineString(metadata.points.map(p => [p.lng, p.lat]));
                geojson = turf.buffer(line, metadata.radius / 1000, { units: 'kilometers' });
            }

            if (geojson) {
                m.addSource('geofence', { type: 'geojson', data: geojson });
                m.addLayer({
                    id: 'geofence-fill',
                    type: 'fill',
                    source: 'geofence',
                    paint: { 'fill-color': metadata.color || '#3b82f6', 'fill-opacity': 0.2 }
                });
                m.addLayer({
                    id: 'geofence-outline',
                    type: 'line',
                    source: 'geofence',
                    paint: { 'line-color': metadata.color || '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] }
                });

                // Fit bounds
                const bbox = turf.bbox(geojson);
                m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 50 });
            }
        });

        map.current = m;

        return () => {
            m.remove();
            map.current = null;
        };
    }, [metadata]);

    // 4. Update Markers on Map
    useEffect(() => {
        if (!map.current) return;

        const currentIds = new Set(trackers.map(t => t.id));

        trackers.forEach(t => {
            const marker = markersRef.current[t.id];
            if (marker) {
                marker.setLngLat([t.lng, t.lat]);
            } else {
                const el = document.createElement('div');
                el.className = 'custom-marker';
                el.innerHTML = `
                    <div class="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-in fade-in duration-300">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="transform: rotate(${t.heading}deg)">
                            <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
                        </svg>
                    </div>
                `;
                const newMarker = new mapboxgl.Marker({ element: el })
                    .setLngLat([t.lng, t.lat])
                    .addTo(map.current!);
                markersRef.current[t.id] = newMarker;
            }
        });

        // Remove old markers
        Object.keys(markersRef.current).forEach(id => {
            if (!currentIds.has(Number(id))) {
                markersRef.current[Number(id)].remove();
                delete markersRef.current[Number(id)];
            }
        });
    }, [trackers]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-slate-600 font-medium">Initializing live geofence view...</p>
            </div>
        );
    }

    if (error || !metadata) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MapPin size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Link Unavailable</h1>
                    <p className="text-slate-500 mb-6">{error || 'This share link is no longer valid or has been removed.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white px-3 py-1 rounded font-black text-lg tracking-tight">UNIFLEET</div>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">{metadata.name}</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Live Dashboard</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-xs font-bold text-slate-400">ZM Ops</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100 font-bold text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live Updates Active
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left side: Vehicle List */}
                <div className="w-96 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700">Vehicles Currently Inside</h2>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs font-bold">{trackers.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {trackers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <MapPin size={32} className="opacity-20 mb-2" />
                                <p className="text-xs font-medium italic">No vehicles detected in zone</p>
                            </div>
                        ) : (
                            trackers.map(t => (
                                <div key={t.id} className="p-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${t.speed > 0 ? 'bg-green-500' : 'bg-slate-400 shadow-sm'}`}></div>
                                            <span className="text-sm font-bold text-slate-800 tracking-tight">{t.label}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t.status}</div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Speed</span>
                                                <span className="text-xs font-black text-slate-700">{Math.round(t.speed)} km/h</span>
                                            </div>
                                            <div className="flex flex-col border-l border-gray-100 pl-3">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Heading</span>
                                                <span className="text-xs font-bold text-slate-600">{Math.round(t.heading)}°</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <Clock size={10} />
                                            <span className="text-[10px] font-medium italic">Updated just now</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right side: Map */}
                <div className="flex-1 relative bg-slate-200">
                    <div ref={mapContainer} className="absolute inset-0" />

                    {/* Map Legend/Overlay */}
                    <div className="absolute top-4 left-4 z-10">
                        <div className="bg-white/90 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-lg text-xs font-bold text-slate-700">
                            Geofence Type: <span className="text-blue-600 uppercase ml-1">{metadata.type}</span>
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                        <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 shadow-md flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600 rounded-full border border-white"></div>
                            <span className="text-[10px] font-bold text-slate-800 uppercase">Tracked Vehicle</span>
                        </div>
                        <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 shadow-md flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600/20 border border-blue-600 rounded-sm"></div>
                            <span className="text-[10px] font-bold text-slate-800 uppercase">Geofence Boundary</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
