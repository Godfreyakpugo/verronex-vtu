import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      // Email link tokens create a session on this page — send
      // verified users straight to the dashboard. Only fall back
      // to login if no session was established.
      navigate(data.session ? "/dashboard" : "/login", { replace: true });
    };

    completeAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-600">Verifying your email...</p>
    </div>
  );
}
