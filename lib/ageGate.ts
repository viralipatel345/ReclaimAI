"use client";
// The age gate on the landing page. Under-18 users are handed to NCMEC's Take It Down,
// and nothing about them is kept: no case, no local storage, no server copy.
import { discardCase, ensureCase } from "./useCase";

export const UNDER_18_ROUTE = "/help/under-18";

export function chooseAge(age: "adult" | "minor"): string {
  if (age === "minor") {
    discardCase();
    return UNDER_18_ROUTE;
  }
  ensureCase();
  return "/case";
}
