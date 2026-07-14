/**
 * Font family tokens for the Sanduqkin design language.
 *
 * With custom font files each weight is its own family name, so components
 * set `fontFamily` (never `fontWeight`) to pick a weight.
 */
export const fonts = {
  serif: {
    regular: "Newsreader_400Regular",
    medium: "Newsreader_500Medium",
    semibold: "Newsreader_600SemiBold",
    italic: "Newsreader_400Regular_Italic",
  },
  sans: {
    regular: "AlbertSans_400Regular",
    medium: "AlbertSans_500Medium",
    semibold: "AlbertSans_600SemiBold",
    bold: "AlbertSans_700Bold",
  },
  mono: {
    regular: "IBMPlexMono_400Regular",
    medium: "IBMPlexMono_500Medium",
  },
} as const;
