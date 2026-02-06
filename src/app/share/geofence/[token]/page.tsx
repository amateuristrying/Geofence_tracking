'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Clock, MapPin, Navigation } from 'lucide-react';
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
    firstSeen?: number; // Internal timer for the shared view
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
    const [region, setRegion] = useState<string>('ZM');

    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Record<number, mapboxgl.Marker>>({});
    const firstSeenRef = useRef<Record<number, number>>({});

    // 1. Fetch metadata on load
    useEffect(() => {
        async function fetchMetadata() {
            try {
                const res = await fetch(`/api/share/resolve?token=${token}`);
                if (!res.ok) throw new Error('Failed to resolve share link');
                const data = await res.json();
                setMetadata(data.zone);
                setRegion(data.region || 'ZM');
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

                const now = Date.now();
                const processed = (data.trackers || []).map((t: any) => {
                    if (!firstSeenRef.current[t.id]) {
                        firstSeenRef.current[t.id] = now;
                    }
                    return {
                        ...t,
                        firstSeen: firstSeenRef.current[t.id]
                    };
                });

                setTrackers(processed);
            } catch (err) {
                console.error('Polling error:', err);
            }
        }

        fetchLive();
        const interval = setInterval(fetchLive, 5000);
        return () => clearInterval(interval);
    }, [metadata, token]);

    // Fast timer for UI updates
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 10000);
        return () => clearInterval(t);
    }, []);

    // 3. Initialize Map
    useEffect(() => {
        if (!mapContainer.current || !metadata || map.current) return;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

        const m = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: metadata.center ? [Number(metadata.center.lng), Number(metadata.center.lat)] : [39.2, -6.8],
            zoom: 15,
            attributionControl: false,
            trackResize: true
        });

        m.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

        // Force resize after mount to handle flexbox delays
        setTimeout(() => m.resize(), 100);
        setTimeout(() => m.resize(), 1000);

        m.on('load', () => {
            console.log('[Map] Loading geofence layer with metadata:', metadata);

            let geojson: any = null;
            try {
                if (metadata.type === 'circle' && metadata.center && metadata.radius) {
                    geojson = turf.circle([Number(metadata.center.lng), Number(metadata.center.lat)], metadata.radius / 1000, { units: 'kilometers' });
                } else if ((metadata.type === 'polygon' || metadata.type === 'zone') && metadata.points && metadata.points.length >= 3) {
                    const coords = metadata.points.map(p => [Number(p.lng), Number(p.lat)]);
                    coords.push(coords[0]);
                    geojson = turf.polygon([coords]);
                } else if (metadata.type === 'sausage' && metadata.points && metadata.points.length >= 2 && metadata.radius) {
                    const line = turf.lineString(metadata.points.map(p => [Number(p.lng), Number(p.lat)]));
                    geojson = turf.buffer(line, metadata.radius / 1000, { units: 'kilometers' });
                }
            } catch (e) {
                console.error('[Map] Turf error processing geojson:', e);
            }

            if (geojson) {
                m.addSource('geofence', { type: 'geojson', data: geojson });
                m.addLayer({
                    id: 'geofence-fill',
                    type: 'fill',
                    source: 'geofence',
                    paint: { 'fill-color': metadata.color || '#3b82f6', 'fill-opacity': 0.15 }
                });
                m.addLayer({
                    id: 'geofence-outline',
                    type: 'line',
                    source: 'geofence',
                    paint: { 'line-color': metadata.color || '#3b82f6', 'line-width': 3, 'line-dasharray': [2, 1] }
                });

                try {
                    const bbox = turf.bbox(geojson);
                    console.log('[Map] Calculated BBox:', bbox);

                    // Ensure bounds are valid numbers
                    const isValidBbox = bbox.every(coord => typeof coord === 'number' && !isNaN(coord) && isFinite(coord));

                    if (isValidBbox) {
                        // Check if the container actually has dimensions
                        const container = m.getContainer();
                        if (container.clientWidth > 0 && container.clientHeight > 0) {
                            m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
                                padding: 60,
                                duration: 1500,
                                animate: true,
                                linear: true // More stable for small shapes
                            });
                        } else {
                            console.warn('[Map] Container has no dimensions, skipping initial fitBounds');
                            // Fallback to center
                            if (metadata.center) {
                                m.setCenter([Number(metadata.center.lng), Number(metadata.center.lat)]);
                            }
                        }
                    }
                } catch (fitError) {
                    console.error('[Map] fitBounds failed:', fitError);
                }
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
                // Update rotation
                const el = marker.getElement();
                const icon = el.querySelector('svg');
                if (icon) icon.style.transform = `rotate(${t.heading}deg)`;
            } else {
                const el = document.createElement('div');
                el.className = 'custom-marker';
                el.innerHTML = `
                    <div class="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-xl">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: rotate(${t.heading}deg); transition: transform 0.5s ease">
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

        Object.keys(markersRef.current).forEach(id => {
            if (!currentIds.has(Number(id))) {
                markersRef.current[Number(id)].remove();
                delete markersRef.current[Number(id)];
            }
        });
    }, [trackers]);

    const formatTime = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return 'Just now';
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) return `${hrs}h ${mins % 60}m`;
        return `${mins}m`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
                <Loader2 className="animate-spin text-blue-400 mb-4" size={48} />
                <p className="text-slate-400 font-medium">Loading Live Fleet Geofence...</p>
            </div>
        );
    }

    if (error || !metadata) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6">
                <div className="max-w-md w-full bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 text-center">
                    <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MapPin size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Link Unavailable</h1>
                    <p className="text-slate-400 mb-6">{error || 'This share link is no longer valid or has been removed.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Header - Premium Minimalist */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-950 text-white px-2.5 py-1 rounded font-black text-lg tracking-tighter">UNIFLEET</div>
                    <div className="h-8 w-px bg-slate-200"></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1 uppercase italic">{metadata.name}</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded tracking-widest uppercase">LIVE DASHBOARD</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">• {region} OPS</span>
                        </div>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full border border-green-100 shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs font-black uppercase tracking-tight">Live System Active</span>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left side: Vehicle List - Matching Dashboard Style */}
                <div className="w-[400px] border-r border-slate-200 bg-white flex flex-col overflow-hidden shadow-inner">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">REAL-TIME OCCUPANCY</h2>
                            <p className="text-sm font-bold text-slate-900 tracking-tight">Vehicles Currently Inside</p>
                        </div>
                        <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-sm font-black ring-4 ring-slate-100">{trackers.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {trackers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
                                <Navigation size={48} className="opacity-10 mb-4 animate-bounce" />
                                <p className="text-sm font-black uppercase tracking-widest italic">Monitoring Zone...</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-1">NO VEHICLES DETECTED IN ZONE</p>
                            </div>
                        ) : (
                            trackers.map(t => (
                                <div key={t.id} className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-default">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className={`w-3 h-3 rounded-full ${t.speed > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-400 shadow-sm'}`}></div>
                                                {t.speed > 0 && <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>}
                                            </div>
                                            <span className="text-base font-black text-slate-900 tracking-tighter uppercase italic">{t.label}</span>
                                        </div>
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${t.speed > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {t.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/50">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">SPEED</span>
                                            <span className="text-sm font-black text-slate-800">{Math.round(t.speed)} <span className="text-[10px] text-slate-400">KM/H</span></span>
                                        </div>
                                        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/50">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">HEADING</span>
                                            <span className="text-sm font-black text-slate-800">{Math.round(t.heading)}°</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <div className="flex items-center gap-1.5 text-blue-600 group-hover:text-blue-700">
                                            <Clock size={14} strokeWidth={3} />
                                            <span className="text-xs font-black tracking-tight">{formatTime(Date.now() - (t.firstSeen || Date.now()))} <span className="text-[9px] opacity-70">INSIDE</span></span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 italic">UPDATED JUST NOW</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right side: Map - Premium Satellite View */}
                <div className="flex-1 relative bg-slate-200">
                    <div ref={mapContainer} className="absolute inset-0" />

                    {/* Map Overlays */}
                    <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
                        <div className="bg-slate-900/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                    {metadata.type} ZONE ACTIVE
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Legend */}
                    <div className="absolute bottom-10 left-10 z-10 pointer-events-none">
                        <div className="flex flex-col gap-2 scale-110 origin-bottom-left">
                            <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-white/20 flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                </div>
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">Live Tracked Assets</span>
                            </div>
                            <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-white/20 flex items-center gap-3">
                                <div className="w-7 h-4 border-2 border-dashed border-blue-500 rounded bg-blue-500/10"></div>
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter tracking-widest">GEOFENCE BOUNDARY</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
