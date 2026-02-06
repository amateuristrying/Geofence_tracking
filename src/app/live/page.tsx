import React from 'react';
import LiveTracker from '@/components/LiveTracker';

export default function LiveDashboardPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <LiveTracker />
            </div>
        </div>
    );
}
