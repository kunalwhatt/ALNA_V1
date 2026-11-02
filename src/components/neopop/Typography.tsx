import React, { ElementType } from "react";
import { FontConfig, FontOverflowType, colorPalette } from "./primitives";

export interface TypographyProps extends Partial<FontConfig> {
  as?: ElementType;
  color?: string;
  overflow?: FontOverflowType;
  lineClamp?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  dangerouslySetInnerHTML?: { __html: string };
  onClick?: React.MouseEventHandler;
  id?: string;
  title?: string;
}

export const Typography: React.FC<TypographyProps> = ({
  as,
  fontType = "body",
  fontSize = 14,
  fontWeight = "400",
  color = colorPalette.popBlack[500],
  overflow,
  lineClamp,
  className = "",
  style = {},
  children,
  dangerouslySetInnerHTML,
  ...rest
}) => {
  // Determine appropriate semantic HTML tag if not specified
  let Component: ElementType = as || "p";
  if (!as) {
    if (fontType === "heading" || fontType === "serif-heading") {
      if (fontSize >= 32) Component = "h1";
      else if (fontSize >= 24) Component = "h2";
      else if (fontSize >= 18) Component = "h3";
      else Component = "h4";
    } else if (fontType === "caps") {
      Component = "span";
    } else {
      Component = "p";
    }
  }

  // Determine font family and typographic styling based on fontType
  let fontFamily = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  let textTransform: "uppercase" | "none" | undefined = undefined;
  let letterSpacing: string | undefined = undefined;
  let lineHeight: string | number = 1.45;

  if (fontType === "serif-heading") {
    fontFamily = '"Cinzel", "Bodoni Moda", "Playfair Display", Georgia, serif';
    letterSpacing = "-0.015em";
    lineHeight = 1.15;
  } else if (fontType === "heading") {
    fontFamily = '"Outfit", "Plus Jakarta Sans", sans-serif';
    letterSpacing = "-0.01em";
    lineHeight = 1.25;
  } else if (fontType === "caps") {
    textTransform = "uppercase";
    letterSpacing = "0.08em";
    lineHeight = 1.3;
  }

  const computedStyle: React.CSSProperties = {
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight,
    color,
    textTransform,
    letterSpacing,
    lineHeight,
    ...style,
  };

  if (overflow === FontOverflowType.ELLIPSIS) {
    computedStyle.whiteSpace = "nowrap";
    computedStyle.overflow = "hidden";
    computedStyle.textOverflow = "ellipsis";
  } else if (overflow === FontOverflowType.CLIP) {
    computedStyle.overflow = "hidden";
  }

  if (lineClamp && lineClamp > 1) {
    computedStyle.display = "-webkit-box";
    computedStyle.WebkitLineClamp = lineClamp;
    computedStyle.WebkitBoxOrient = "vertical";
    computedStyle.overflow = "hidden";
  }

  if (dangerouslySetInnerHTML) {
    return (
      <Component
        className={className}
        style={computedStyle}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        {...rest}
      />
    );
  }

  return (
    <Component className={className} style={computedStyle} {...rest}>
      {children}
    </Component>
  );
};
