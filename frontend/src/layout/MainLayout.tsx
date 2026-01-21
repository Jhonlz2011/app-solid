import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { Sidebar } from './components/sidebar';
import MobileHeader from './components/MobileHeader';

const MainLayout: ParentComponent = () => {
    return (
        <div class="flex h-screen bg-background overflow-hidden">
            {/* Mobile Header - Only visible on small screens */}
            <MobileHeader />
            {/* Sidebar */}
            <Sidebar />
            {/* Main Content Area */}
            <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative pt-14 sm:pt-0">
                {/* Content Scrollable Area */}
                <div class="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
