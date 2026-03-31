import { Personne } from "./personnes";
import { Deplacement } from "./deplacement";

export interface Maison {
    id: string;
    nom: string;
    personnes: Personne[];
    historique: Deplacement[];
}

export interface PluginData {
    maisons: Maison[];
    activeMaisonId: string;
}