import React from "react";

export interface NeoCardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: "sm" | "md" | "lg" | "flat";
  variant?: "porcelain" | "sand" | "gold" | "dark";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
  id?: string;
}

export const NeoCard: React.FC<NeoCardProps> = ({
  children,
  className = "",
  elevation = "md",
  variant = "porcelain",
  onClick,
  style,
  id,
}) => {
  const elevationStyles = {
    flat: "shadow-none",
    sm: "shadow-[2px_2px_0px_#0A0D14]",
    md: "shadow-[4px_4px_0px_#0A0D14]",
    lg: "shadow-[6px_6px_0px_#0A0D14]",
  };

  const variantStyles = {
    porcelain: "bg-[#FFFFFF] text-[#0A0D14] border-2 border-[#0A0D14]",
    sand: "bg-[#F7F5EE] text-[#0A0D14] border-2 border-[#0A0D14]",
    gold: "bg-[#FFF9E6] text-[#0A0D14] border-2 border-[#D4AF37]",
    dark: "bg-[#0A0D14] text-[#FAF8F5] border-2 border-[#0A0D14]",
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      id={id}
      onClick={onClick}
      style={style}
      className={`relative transition-all duration-150 ${elevationStyles[elevation]} ${variantStyles[variant]} ${
        isClickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#0A0D14] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#0A0D14]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
