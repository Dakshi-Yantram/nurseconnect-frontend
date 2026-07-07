import type { Visit } from "./mock-data";

const newVisits: Visit[] = [];

export function addVisit(visit: Visit) {
  newVisits.unshift(visit);
}

export function getNewVisits(): Visit[] {
  return newVisits;
}
