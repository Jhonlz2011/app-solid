import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import Sidebar from './components/Sidebar';

const MainLayout: ParentComponent = () => {
    return (
        <div class="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <Sidebar />
            {/* Main Content Area */}
            <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Content Scrollable Area */}
                <div class="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
