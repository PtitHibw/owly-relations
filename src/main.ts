import { normalizePath, Plugin, WorkspaceLeaf } from "obsidian";
import { HouseView, VIEW_TYPE_HOUSE } from "./HouseView";
import { PluginData, Maison } from "./data/pluginData";
import { DEFAULT_PERSONNES } from "./data/personnes";
import { RelationshipHouseSettings, DEFAULT_SETTINGS } from "./settings";
import { RelationshipHouseSettingsTab } from "./ui/SettingsTab";

type LegacyData = {
    personnes?: never[];
    historique?: never[];
    settings?: Partial<RelationshipHouseSettings>;
};

type StoredData = {
    maisons?: Maison[];
    activeMaisonId?: string;
    settings?: Partial<RelationshipHouseSettings>;
};

export default class RelationshipHousePlugin extends Plugin {
    data: PluginData;
    settings: RelationshipHouseSettings;

    async onload() {
        this.data = await this.loadPluginData();
        await this.loadSettings();
        this.addSettingTab(new RelationshipHouseSettingsTab(this.app, this));

        this.registerView(
            VIEW_TYPE_HOUSE,
            (leaf: WorkspaceLeaf) =>
                new HouseView(leaf, this.getAssetsPath(), this)
        );

        this.addRibbonIcon("home", "Maison des relations", () => {
            void this.activateView();
        });
    }

    // ── Chargement + migration automatique ──────────────────────────────────

    async loadPluginData(): Promise<PluginData> {
        const raw = await this.loadData() as StoredData & LegacyData | null;

        // Ancien format détecté → migration vers une maison "Maison principale"
        if (raw && "personnes" in raw && Array.isArray(raw.personnes)) {
            const legacy = raw;
            const maisonPrincipale: Maison = {
                id: crypto.randomUUID(),
                nom: "Maison principale",
                personnes: legacy.personnes ?? [],
                historique: legacy.historique ?? [],
            };
            return {
                maisons: [maisonPrincipale],
                activeMaisonId: maisonPrincipale.id,
            };
        }

        // Nouveau format
        if (raw && "maisons" in raw && Array.isArray(raw.maisons) && raw.maisons.length > 0) {
            return {
                maisons: raw.maisons,
                activeMaisonId: raw.activeMaisonId ?? (raw.maisons[0]?.id ?? ""),
            };
        }

        // Aucune donnée → première installation
        const maisonDefaut: Maison = {
            id: crypto.randomUUID(),
            nom: "Maison principale",
            personnes: structuredClone(DEFAULT_PERSONNES),
            historique: [],
        };
        return {
            maisons: [maisonDefaut],
            activeMaisonId: maisonDefaut.id,
        };
    }

    async loadSettings() {
        const raw = await this.loadData() as StoredData | null;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...(raw?.settings ?? {}),
        };
    }

    // ── Sauvegarde unifiée ───────────────────────────────────────────────────

    async save() {
        await this.saveData({
            maisons: this.data.maisons,
            activeMaisonId: this.data.activeMaisonId,
            settings: this.settings,
        });
    }

    // Raccourcis gardés pour compatibilité avec le reste du code existant
    async savePluginData() { await this.save(); }
    async saveSettings()   { await this.save(); }

    // ── Helpers maisons ──────────────────────────────────────────────────────

    getActiveMaison(): Maison {
    	return (
        	this.data.maisons.find(m => m.id === this.data.activeMaisonId)
        	?? this.data.maisons[0]
    	) as Maison;
	}

    async setActiveMaison(id: string) {
        this.data.activeMaisonId = id;
        await this.save();
        this.refreshHouseViews();
    }

    async addMaison(nom: string): Promise<Maison> {
        const maison: Maison = {
            id: crypto.randomUUID(),
            nom,
            personnes: [],
            historique: [],
        };
        this.data.maisons.push(maison);
        await this.save();
        return maison;
    }

    async deleteMaison(id: string) {
        // On ne peut pas supprimer la dernière maison
        if (this.data.maisons.length <= 1) return;

        this.data.maisons = this.data.maisons.filter(m => m.id !== id);

        // Si on supprime la maison active, on bascule sur la première
        if (this.data.activeMaisonId === id) {
            this.data.activeMaisonId = this.data.maisons[0]?.id ?? "";
        }
        await this.save();
        this.refreshHouseViews();
    }

    async renameMaison(id: string, newNom: string) {
        const maison = this.data.maisons.find(m => m.id === id);
        if (maison) {
            maison.nom = newNom;
            await this.save();
        }
    }

    // ── Refresh ──────────────────────────────────────────────────────────────

    refreshHouseViews() {
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view.getViewType?.() === VIEW_TYPE_HOUSE) {
                void (leaf.view as HouseView).refresh();
            }
        });
    }

    getAssetsPath(): string {
        return normalizePath(this.manifest.dir + "/assets");
    }

    async activateView() {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE_HOUSE, active: true });
        await this.app.workspace.revealLeaf(leaf);
    }
}