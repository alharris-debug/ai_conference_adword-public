"use client";

// Global "animations on/off" switch. Lottie loops longer than five seconds
// need a pause affordance (WCAG 2.2.2); this is it, and it also stills Framer.

import { createContext, useContext } from "react";

export const AnimationsContext = createContext<boolean>(true);
export const useAnimationsEnabled = () => useContext(AnimationsContext);
