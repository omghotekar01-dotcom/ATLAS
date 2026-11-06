import { createContext, useContext, useState, type ReactNode } from "react";

/** Sample preview is OFF by default and never persisted, so live mode is always the starting state. */
const Ctx = createContext<{ sample: boolean; setSample: (v: boolean) => void }>({
  sample: false,
  setSample: () => {},
});

export function SampleModeProvider({ children }: { children: ReactNode }) {
  const [sample, setSample] = useState(false);
  return <Ctx.Provider value={{ sample, setSample }}>{children}</Ctx.Provider>;
}

export const useSampleMode = () => useContext(Ctx);
