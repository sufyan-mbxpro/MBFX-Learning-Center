"use client";

// next-themes with attribute="class" — pairs with globals.css's
// @custom-variant dark and ADR-008: user-controlled mode, admin-controlled
// branding, never the reverse. Shared by both surfaces (the admin shell
// mounts it too — sonner's Toaster reads useTheme() and needs a provider).
import { ThemeProvider as NextThemesProvider } from "next-themes";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
