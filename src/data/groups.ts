export interface Groupe {
    id: string;
    label: string;
    emoji: string;
}

export const DEFAULT_GROUPES: Groupe[] = [
    { id: "famille", label: "Famille", emoji: "👨‍👩‍👧‍👦" },
    { id: "amis", label: "Amis", emoji: "🧑‍🤝‍🧑" }
];
