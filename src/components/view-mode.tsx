"use client";

import { createContext, useContext, type ReactNode } from "react";

// Basit / gelişmiş görünüm: istemci bileşenleri ayrıntılı alanları göstermek için okur.
const ViewModeContext = createContext(false);

export function ViewModeProvider({ advanced, children }: { advanced: boolean; children: ReactNode }) {
  return <ViewModeContext.Provider value={advanced}>{children}</ViewModeContext.Provider>;
}

/** true: gelişmiş görünüm (tüm ayrıntılar açık). */
export function useAdvancedView() {
  return useContext(ViewModeContext);
}
