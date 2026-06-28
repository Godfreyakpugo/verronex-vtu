import logo from "../../assets/vtu-verronex-logo.png";

function BrandLogo({
  className = "",
  showText = true,
  size = "md",
  textClassName = "text-slate-900",
  subTextClassName = "text-slate-500",
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logo}
        alt="Verronex VTU logo"
        className={`${sizeClasses[size] ?? sizeClasses.md} object-contain rounded-xl shadow-sm`}
      />
      {showText && (
        <div className="leading-tight">
          <p className={`text-sm font-semibold ${textClassName}`}>
            Verronex <span className="text-fuchsia-600">VTU</span>
          </p>
          <p
            className={`text-[10px] uppercase tracking-[0.25em] ${subTextClassName}`}
          >
            Digital access
          </p>
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
