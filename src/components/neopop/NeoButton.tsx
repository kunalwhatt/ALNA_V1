import React from "react";
import { playPorcelainClick } from "../../utils/audio";

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold" | "crimson" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const NeoButton: React.FC<NeoButtonProps> = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playPorcelainClick();
    if (onClick) onClick(e);
  };

  const baseStyles =
    "relative inline-flex items-center justify-center font-bold tracking-tight transition-all duration-150 select-none cursor-pointer border-2 border-[#0A0D14] font-['Plus_Jakarta_Sans',sans-serif]";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs shadow-[2px_2px_0px_#0A0D14] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
    md: "px-5 py-2.5 text-sm shadow-[4px_4px_0px_#0A0D14] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
    lg: "px-7 py-3.5 text-base shadow-[5px_5px_0px_#0A0D14] active:shadow-none active:translate-x-[5px] active:translate-y-[5px]",
  };

  const variantStyles = {
    primary: "bg-[#0A0D14] text-white hover:bg-[#1A202C]",
    secondary: "bg-[#FAF8F5] text-[#0A0D14] hover:bg-white",
    gold: "bg-[#D4AF37] text-[#0A0D14] hover:bg-[#F59E0B]",
    crimson: "bg-[#B8304A] text-white hover:bg-[#8E1F37]",
    ghost: "bg-transparent text-[#0A0D14] border-transparent shadow-none hover:bg-black/5 active:translate-none",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      onClick={handleClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
