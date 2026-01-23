import { App, PluginSettingTab, Setting, Modal } from "obsidian";
import RelationshipHousePlugin from "../main";
import { OUTSIDE_HOUSE } from "../data/constants";
import { getDisplayName } from "../data/personnes";
import "emoji-picker-element";

class EmojiPickerModal extends Modal {
    constructor(
        app: App,
        private plugin: RelationshipHousePlugin,
        private onSelect: (emoji: string) => void
    ) {
        super(app);
    }


    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.addClass("emoji-picker-modal");

        // Titre
        this.titleEl.setText("Choisir un emoji");
        this.titleEl.addClass("emoji-picker-title");

        const picker = document.createElement("emoji-picker");
        picker.addClass("emoji-picker-element");

        contentEl.appendChild(picker);

        this.plugin.registerDomEvent(
            picker as HTMLElement,
            "emoji-click" as unknown as keyof HTMLElementEventMap,
            (e: any) => {
                this.onSelect(e.detail.unicode);
                this.close();
            }
        );


    }


    onClose() {
        this.contentEl.empty();
    }
}


export class RelationshipHouseSettingsTab extends PluginSettingTab {
    plugin: RelationshipHousePlugin;

    constructor(app: App, plugin: RelationshipHousePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();


        // ───────── GROUPES ─────────
        this.renderGroupes(containerEl);
        this.addSpacer(containerEl, 34);
        this.renderPieces(containerEl);

    }
    private addSpacer(container: HTMLElement, height = 16) {
        const spacer = container.createDiv("settings-spacer");
        spacer.style.setProperty("--spacer-height", `${height}px`);

    }

    private renderGroupes(container: HTMLElement) {
        const groupes = this.plugin.settings.groupes;

        new Setting(container)
            .setName("Groupes")
            .setHeading();


        groupes.forEach((g, index) => {
            const row = container.createDiv("group-row");


            // Nom
            const nameInput = row.createEl("input", { type: "text", value: g.label });
            nameInput.addClass("group-name-input");
            nameInput.placeholder = "Nom du groupe";
            nameInput.oninput = async () => {
                g.label = nameInput.value;
                await this.plugin.saveSettings();
            };

            // Emoji picker
            const emojiBtn = row.createEl("button", { text: g.emoji || "✨" });
            emojiBtn.addClass("group-emoji-btn");


            emojiBtn.onclick = () => {
                new EmojiPickerModal(
                    this.app,
                    this.plugin,
                    (emoji) => {
                        g.emoji = emoji;
                        emojiBtn.textContent = emoji;
                        this.plugin.saveSettings();
                    }
                ).open();

            };


            // Bouton supprimer
            const deleteBtn = row.createEl("button", { text: "🗑" });
            deleteBtn.onclick = async () => {
                this.plugin.settings.groupes.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            };
        });

        // Bouton ajouter
        const addBtn = container.createEl("button", { text: "+ Ajouter un groupe" });
        addBtn.addClass("group-add-btn");

        addBtn.onclick = async () => {
            this.plugin.settings.groupes.push({
                id: crypto.randomUUID(),
                label: "Nouveau groupe",
                emoji: "✨"
            });
            await this.plugin.saveSettings();
            this.display();
        };
    }
   
    private renderPieces(container: HTMLElement) {
        new Setting(container)
            .setName("Pièces")
            .setHeading();


        const pieces = this.plugin.settings.pieces;

        pieces.forEach(p => {
            const row = container.createDiv("piece-row");

            // Nom
            const name = row.createEl("input", { type: "text", value: p.label });
            name.addClass("piece-name");
            name.oninput = async () => {
                p.label = name.value;
                await this.plugin.saveSettings();
                this.plugin.refreshHouseViews();
            };

            // Description
            const desc = row.createEl("input", {
                type: "text",
                value: p.description ?? ""
            });
            desc.addClass("piece-desc");
            desc.placeholder = "Description (tooltip)";
            desc.oninput = async () => {
                p.description = desc.value;
                await this.plugin.saveSettings();
                this.plugin.refreshHouseViews();
            };

            // Visible
            const checkbox = row.createEl("input", { type: "checkbox" });
            checkbox.checked = p.visible;
            checkbox.onchange = async () => {
                const wasVisible = p.visible;
                p.visible = checkbox.checked;

                if (wasVisible && !p.visible) {
                    // expulsion immédiate et historique
                    this.plugin.data.personnes.forEach(person => {
                        if (person.pieceId === p.id) {
                            this.plugin.data.historique.push({
                                id: Date.now().toString(),
                                personneId: person.id,
                                personneNom: getDisplayName(person),
                                personneCouleur: person.couleur,
                                pieceFrom: p.id,
                                pieceTo: OUTSIDE_HOUSE,
                                date: new Date().toISOString(),
                            });
                            person.pieceId = undefined;
                        }
                    });
                    await this.plugin.savePluginData();
                }

                await this.plugin.saveSettings();
                this.plugin.refreshHouseViews(); // ← rafraîchit le HouseView
            };

        });
    }
    

}
