"use client";

import { useEffect } from "react";
import { clearPlanStorage } from "./plan-wizard";

/** Forgets the saved questionnaire once its trip exists. */
export function ClearPlanDraft() {
  useEffect(() => clearPlanStorage(), []);
  return null;
}
