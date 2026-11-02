/**
 * CRED NeoPOP Design System Primitives
 * Types, variants, and color palettes
 */

export enum FontOverflowType {
  ELLIPSIS = "ellipsis",
  CLIP = "clip",
}

export const colorPalette = {
  popBlack: {
    100: "#7B8191",
    200: "#535A6D",
    300: "#32394C",
    400: "#1A202C",
    500: "#0A0D14",
  },
  popWhite: {
    100: "#F4F0E8",
    200: "#FAF7EE",
    300: "#FCFAF4",
    400: "#FEFDFB",
    500: "#FFFFFF",
  },
  gold: {
    200: "#FFF6D6",
    300: "#FFE066",
    400: "#F59E0B",
    500: "#D4AF37",
    600: "#C9892B",
  },
  crimson: {
    100: "#FDE8EC",
    300: "#F87171",
    400: "#D9566C",
    500: "#B8304A",
    600: "#8E1F37",
  },
  cobalt: {
    100: "#EBF1FF",
    300: "#60A5FA",
    400: "#3F64B8",
    500: "#22418A",
    600: "#1B2A4A",
  },
  teal: {
    100: "#E6F6F4",
    400: "#3E86A8",
    500: "#8FD0CB",
  },
};

export const mainColors = {
  black: "#0A0D14",
  white: "#FFFFFF",
  yellow: "#F59E0B",
  gold: "#D4AF37",
  crimson: "#B8304A",
  cobalt: "#22418A",
  cream: "#FAF7EE",
  sand: "#F4EFE6",
  muted: "#5A6788",
  border: "#0A0D14",
};

export interface FontConfig {
  fontType: "heading" | "serif-heading" | "caps" | "body";
  fontSize: number;
  fontWeight: string | number;
}

export const FontVariant: Record<string, FontConfig> = {
  // Heading Variants
  HeadingBold14: { fontType: "heading", fontSize: 14, fontWeight: "700" },
  HeadingSemiBold16: { fontType: "heading", fontSize: 16, fontWeight: "600" },
  HeadingBold18: { fontType: "heading", fontSize: 18, fontWeight: "700" },
  HeadingBold20: { fontType: "heading", fontSize: 20, fontWeight: "700" },
  HeadingBold24: { fontType: "heading", fontSize: 24, fontWeight: "700" },
  HeadingBold28: { fontType: "heading", fontSize: 28, fontWeight: "800" },
  HeadingBold32: { fontType: "heading", fontSize: 32, fontWeight: "800" },
  HeadingBold40: { fontType: "heading", fontSize: 40, fontWeight: "800" },
  HeadingBold48: { fontType: "heading", fontSize: 48, fontWeight: "900" },

  // Serif (Cirka / Cinzel / Bodoni) Heading Variants
  CirkaHeadingBold18: { fontType: "serif-heading", fontSize: 18, fontWeight: "700" },
  CirkaHeadingBold20: { fontType: "serif-heading", fontSize: 20, fontWeight: "700" },
  CirkaHeadingBold24: { fontType: "serif-heading", fontSize: 24, fontWeight: "800" },
  CirkaHeadingBold28: { fontType: "serif-heading", fontSize: 28, fontWeight: "800" },
  CirkaHeadingBold36: { fontType: "serif-heading", fontSize: 36, fontWeight: "800" },
  CirkaHeadingBold48: { fontType: "serif-heading", fontSize: 48, fontWeight: "900" },
  CirkaHeadingBold60: { fontType: "serif-heading", fontSize: 60, fontWeight: "900" },

  // Caps Variants
  CapsBold10: { fontType: "caps", fontSize: 10, fontWeight: "700" },
  CapsBold11: { fontType: "caps", fontSize: 11, fontWeight: "700" },
  CapsBold12: { fontType: "caps", fontSize: 12, fontWeight: "700" },
  CapsBold14: { fontType: "caps", fontSize: 14, fontWeight: "800" },

  // Body Variants
  BodyRegular12: { fontType: "body", fontSize: 12, fontWeight: "400" },
  BodyRegular13: { fontType: "body", fontSize: 13, fontWeight: "400" },
  BodyRegular14: { fontType: "body", fontSize: 14, fontWeight: "400" },
  BodyRegular16: { fontType: "body", fontSize: 16, fontWeight: "400" },
  BodyMedium14: { fontType: "body", fontSize: 14, fontWeight: "500" },
  BodyMedium16: { fontType: "body", fontSize: 16, fontWeight: "500" },
  BodySemiBold14: { fontType: "body", fontSize: 14, fontWeight: "600" },
  BodySemiBold16: { fontType: "body", fontSize: 16, fontWeight: "600" },
  BodyBold14: { fontType: "body", fontSize: 14, fontWeight: "700" },
  BodyBold16: { fontType: "body", fontSize: 16, fontWeight: "700" },
};
