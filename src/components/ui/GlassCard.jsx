function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`
        backdrop-blur-xl
        bg-white/65
        border border-fuchsia-200/70
        rounded-2xl
        shadow-[0_10px_35px_rgba(236,72,153,0.12)]
        hover:border-fuchsia-400/70
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default GlassCard;
