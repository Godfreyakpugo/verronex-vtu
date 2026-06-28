import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuth = async () => {
      await supabase.auth.getSession();
      navigate("/login", { replace: true });
    };

    completeAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-600">Verifying your email...</p>
    </div>
  );
}
