import { App, PluginSettingTab, Setting, Modal } from "obsidian";
import RelationshipHousePlugin from "../main";
import { OUTSIDE_HOUSE } from "../data/constants";
import { getDisplayName } from "../data/personnes";
import "emoji-picker-element";

class EmojiPickerModal extends Modal {
    constructor(app: App, private onSelect: (emoji: string) => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        // Style général du modal
        Object.assign(contentEl.style, {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "var(--background-primary)", // ou un ton sympa
            borderRadius: "8px",
        });

        // Titre
        const title = contentEl.createEl("h3", { text: "Choisis un emoji" });
        Object.assign(title.style, {
            margin: "0 0 8px 0",
            fontSize: "14px",
            color: "var(--text-normal)",
        });

        const picker = document.createElement("emoji-picker");
        Object.assign(picker.style, {
            width: "100%",
            maxHeight: "500px",
            borderRadius: "6px",
            overflow: "auto",
        });

        contentEl.appendChild(picker);

        picker.addEventListener("emoji-click", (e: any) => {
            this.onSelect(e.detail.unicode);
            this.close();
        });
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

        containerEl.createEl("h1", { text: "Maison des relations — Paramètres" });

        // ───────── GROUPES ─────────
        this.renderGroupes(containerEl);
        this.addSpacer(containerEl, 34);
        this.renderPieces(containerEl);

    }
    private addSpacer(container: HTMLElement, height = 16) {
        const spacer = container.createDiv();
        spacer.style.height = `${height}px`;
    }

    private renderGroupes(container: HTMLElement) {
        const groupes = this.plugin.settings.groupes;

        container.createEl("h2", { text: "Groupes de personnes" });

        groupes.forEach((g, index) => {
            const row = container.createDiv("group-row");
            row.style.display = "flex";
            row.style.gap = "8px";
            row.style.alignItems = "center";
            row.style.marginBottom = "4px";

            // Nom
            const nameInput = row.createEl("input", { type: "text", value: g.label });
            nameInput.style.flex = "1";
            nameInput.placeholder = "Nom du groupe";
            nameInput.oninput = async () => {
                g.label = nameInput.value;
                await this.plugin.saveSettings();
            };

            // Emoji picker
            const emojiBtn = row.createEl("button", { text: g.emoji || "✨" });
            emojiBtn.style.width = "32px";
            emojiBtn.style.height = "32px";
            emojiBtn.style.fontSize = "20px";
            emojiBtn.style.cursor = "pointer";

            emojiBtn.onclick = () => {
                new EmojiPickerModal(this.app, (emoji) => {
                    g.emoji = emoji;
                    emojiBtn.textContent = emoji;
                    this.plugin.saveSettings();
                }).open();
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
        addBtn.style.width = "100%";
        addBtn.style.background = "var(--background-secondary)";
        addBtn.style.color = "white";
        addBtn.style.border = "none";
        addBtn.style.padding = "6px";
        addBtn.style.borderRadius = "4px";
        addBtn.style.cursor = "pointer";
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
        container.createEl("h2", { text: "Configuration des pièces" });

        const pieces = this.plugin.settings.pieces;

        pieces.forEach(p => {
            const row = container.createDiv();
            row.style.display = "flex";
            row.style.gap = "6px";
            row.style.alignItems = "center";
            row.style.marginBottom = "6px";


            // Nom
            const name = row.createEl("input", { type: "text", value: p.label });
            name.style.flex = "1";
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
            desc.style.flex = "2";
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
