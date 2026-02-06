'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        router.push('/live');
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">UniFleet Live Tracker</h1>
                <p className="text-slate-500">Redirecting to dashboard...</p>
            </div>
        </div>
    );
}
