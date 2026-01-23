import { normalizePath, Plugin, WorkspaceLeaf } from "obsidian";
import { HouseView, VIEW_TYPE_HOUSE } from "./HouseView";
import { PluginData } from "./data/pluginData";
import { DEFAULT_PERSONNES } from "./data/personnes";
import { RelationshipHouseSettings, DEFAULT_SETTINGS } from "./settings";
import { RelationshipHouseSettingsTab } from "./ui/SettingsTab";

type StoredData = Partial<PluginData> & {
	settings?: Partial<RelationshipHouseSettings>;
};

export default class RelationshipHousePlugin extends Plugin {
	data: PluginData;
	settings: RelationshipHouseSettings;

	async onload() {
		this.data = await this.loadPluginData();
		await this.loadSettings();
		this.addSettingTab(
			new RelationshipHouseSettingsTab(this.app, this)
		);

		this.registerView(
			VIEW_TYPE_HOUSE,
			(leaf: WorkspaceLeaf) =>
				new HouseView(leaf, this.getAssetsPath(), this)
		);

		this.addRibbonIcon("home", "Maison des relations", () => {
			void this.activateView();
		});
	}

	async loadPluginData(): Promise<PluginData> {
		const loaded = (await this.loadData()) as StoredData | null;

		if (!loaded) {
			return {
				personnes: structuredClone(DEFAULT_PERSONNES),
				historique: []
			};
		}

		return {
			personnes: loaded.personnes ?? structuredClone(DEFAULT_PERSONNES),
			historique: loaded.historique ?? []
		};
	}


	async loadSettings() {
		const loaded = (await this.loadData()) as StoredData | null;

		this.settings = {
			...DEFAULT_SETTINGS,
			...(loaded?.settings ?? {})
		};
	}


	async saveSettings() {
		const existing = (await this.loadData()) as StoredData | null;

		await this.saveData({
			...(existing ?? {}),
			settings: this.settings
		});
	}


	refreshHouseViews() {
		this.app.workspace.iterateAllLeaves(leaf => {
			const view = leaf.view;
			if (view.getViewType?.() === VIEW_TYPE_HOUSE) {
				void (view as HouseView).refresh();
			}
		});
	}


	async savePluginData() {
		await this.saveData(this.data);
	}

	getAssetsPath(): string {
		return normalizePath(this.manifest.dir + "/assets");
	}

	async activateView() {
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_HOUSE,
			active: true
		});
		await this.app.workspace.revealLeaf(leaf);
	}
}
