import { normalizePath, Plugin, WorkspaceLeaf } from "obsidian";
import { HouseView, VIEW_TYPE_HOUSE } from "./HouseView";
import { PluginData } from "./data/pluginData";
import { DEFAULT_PERSONNES } from "./data/personnes";
import { RelationshipHouseSettings, DEFAULT_SETTINGS } from "./settings";
import { RelationshipHouseSettingsTab } from "./ui/SettingsTab";
/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-call */


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
		const loaded = await this.loadData();

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
		const loaded = await this.loadData();

		this.settings = {
			...DEFAULT_SETTINGS,
			...(loaded?.settings ?? {})
		};
	}

	async saveSettings() {
		const existing = await this.loadData();
		await this.saveData({
			...existing,
			settings: this.settings
		});
	}

	refreshHouseViews() {
		this.app.workspace.iterateAllLeaves(leaf => {
			const view = leaf.view as any;
			if (view?.getViewType?.() === "relationship-house-view") {
				view.refresh?.();
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
