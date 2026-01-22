import { Personne } from "./personnes";
import { Deplacement } from "./deplacement";

export interface PluginData {
    personnes: Personne[];
    historique: Deplacement[];
}
