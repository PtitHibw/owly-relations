import { Personne } from "../data/personnes";

export const OUTSIDE_HOUSE = "__outside__";

export function getFullName(p: Personne): string {
    return [p.prenom, p.nom].filter(Boolean).join(" ");
}
