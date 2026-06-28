import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6 max-w-4xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default Shell;
