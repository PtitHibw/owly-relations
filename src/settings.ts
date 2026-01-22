import { Groupe, DEFAULT_GROUPES } from "./data/groups";
import { DEFAULT_PIECES } from "./data/pieces";

export interface PieceSettings {
    id: string;
    label: string;
    description?: string;
    visible: boolean;
}

export interface RelationshipHouseSettings {
    groupes: Groupe[];
    pieces: PieceSettings[];
}

export const DEFAULT_SETTINGS: RelationshipHouseSettings = {
    groupes: DEFAULT_GROUPES,
    pieces: DEFAULT_PIECES.map(p => ({
        id: p.id,
        label: p.nom,
        description: p.description ?? "",
        visible: true,
    }))
};
