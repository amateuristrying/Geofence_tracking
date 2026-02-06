import React, { Suspense } from 'react';
import LiveTracker from '@/components/LiveTracker';
import { Loader2 } from 'lucide-react';

export default function LiveDashboardPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                    </div>
                }>
                    <LiveTracker />
                </Suspense>
            </div>
        </div>
    );
}
