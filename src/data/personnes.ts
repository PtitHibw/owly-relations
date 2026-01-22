export interface Personne {
    id: string;
    prenom: string;
    nom: string;
    surnom: string;

    groupes?: string[]; // 👈 ids des groupes

    naissance?: string;
    couleur?: string;
    notePath?: string;
    commentaire?: string;
    pieceId?: string;
}




export const DEFAULT_PERSONNES: Personne[] = [
    
];


export function getDisplayName(p: Personne): string {
    return (
        p.surnom ||
        [p.prenom, p.nom].filter(Boolean).join(" ") ||
        p.nom ||
        p.id
    );
}
