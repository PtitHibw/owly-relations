export interface Deplacement {
    id: string;
    personneId: string;
    personneNom: string;
    personneCouleur?: string;
    pieceFrom: string;
    pieceTo: string;
    date: string;
    commentaire?: string;
}
