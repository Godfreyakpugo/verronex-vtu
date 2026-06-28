import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.18),_transparent_30%),linear-gradient(135deg,_#fdf2f8_0%,_#fff7ed_50%,_#fdf2f8_100%)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Content pushed right on desktop */}
      <div className="lg:ml-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6 max-w-4xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default Shell;
