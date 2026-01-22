export interface Piece {
    id: string;
    nom: string;
    description?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export const DEFAULT_PIECES: Piece[] = [
    { 
        id: "portail", 
        nom: "Portail", 
        description: "Personnes vues brièvement, laissant une bonne impression mais sans lien établi", 
        x: 417, y: 5, width: 545, height: 91 },
    { 
        id: "jardin", 
        nom: "Jardin", 
        description: "Personnes avec un lien naissant, attendant de se construire plus précisement", 
        x: 79, y: 4, width: 334, height: 194 },
    { 
        id: "entree", 
        nom: "Entrée", 
        description: "Personnes avec un lien faible mais présent, en cours de construction", 
        x: 606, y: 100, width: 156, height: 200 },
    { 
        id: "toilette", 
        nom: "Toilette", 
        description: "Personnes avec un lien conflictuel", 
        x: 417, y: 402, width: 185, height: 73 },
    { 
        id: "salon", 
        nom: "Salon", 
        description: "Personnes avec un lien stable, avec qui on se sent bien et à l'aise", 
        x: 766, y: 100, width: 196, height: 279 },
    { 
        id: "salledebain", 
        nom: "Salle de bain", 
        description: "Personnes avec un lien fort, avec qui l'on partage des moments de vulnérabilité", 
        x: 417, y: 479, width: 185, height: 139 },
    { 
        id: "cuisine", 
        nom: "Cuisine", 
        description: "Personnes de confiance avec un lien fort", 
        x: 417, y: 100, width: 185, height: 298 },
    { 
        id: "chambre", 
        nom: "Chambre", 
        description: "Personnes de haute confiance, avec un lien très fort", 
        x: 766, y: 383, width: 196, height: 235 },
    {
        id: "reserve",
        nom: "Réserve",
        description: "Personnes du passé avec un lien réactivé, retrouvé",
        x: 189, y: 202, width: 179, height: 100 },
    { 
        id: "grenier", 
        nom: "Grenier", 
        description: "Personnes de notre passé avec un lien inactif, mais liées par des souvenirs communs", 
        x: 4, y: 364, width: 334, height: 318 }
];
