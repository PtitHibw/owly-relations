import { App, Modal, Setting } from "obsidian";
import RelationshipHousePlugin from "../main";
import { Personne } from "../data/personnes";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

export class PersonModal extends Modal {
    private data: Partial<Personne>;

    constructor(
        app: App,
        private plugin: RelationshipHousePlugin,
        private onSave: () => void,
        person?: Personne
    ) {
        super(app);

        this.data = person
            ? { ...person }
            : {
                id: crypto.randomUUID(),
                prenom: "",
                nom: "",
                surnom: "",
                couleur: "#000000",
                pieceId: undefined,
                groupes: []
            };
    }

    onOpen() {
        this.render();
    }

    /* ───────────────────────────── */
    /* RENDER PRINCIPAL              */
    /* ───────────────────────────── */
    private render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("person-modal");

        this.titleEl.setText(
            this.isEdit() ? "Modifier un contact" : "Ajouter un contact"
        );

        /* ───────── IDENTITÉ ───────── */
        contentEl.createEl("h3", { text: "- IDENTITÉ -" });
        
        new Setting(contentEl)
            .setName("Surnom")
            .setDesc("Affiché sur les badges si présent")
            .addText(t =>
                t.setValue(this.data.surnom ?? "")
                    .onChange(v => (this.data.surnom = v))
            );

        new Setting(contentEl)
            .setName("Prénom")
            .setDesc("Optionnel")
            .addText(t =>
                t.setValue(this.data.prenom ?? "")
                    .onChange(v => (this.data.prenom = v))
            );

        new Setting(contentEl)
            .setName("Nom")
            .setDesc("Optionnel")
            .addText(t =>
                t.setValue(this.data.nom ?? "")
                    .onChange(v => (this.data.nom = v))
            );

        

        /* ───────── INFOS ───────── */
        contentEl.createEl("h3", { text: "- INFORMATIONS -" });

        new Setting(contentEl)
            .setName("Date de naissance")
            .addText(t => {
                t.inputEl.type = "date";
                t.setValue(this.data.naissance ?? "")
                    .onChange(v => (this.data.naissance = v));
            });

        new Setting(contentEl)
            .setName("Couleur du badge")
            .setDesc("Couleur associée à cette personne")
            .addColorPicker(c =>
                c.setValue(this.data.couleur ?? "#888888")
                    .onChange(v => (this.data.couleur = v))
            );

        new Setting(contentEl)
            .setName("Groupes")
            .then(setting => {
                // IMPORTANT : on nettoie le controlEl
                setting.controlEl.empty();
                this.renderNativeGroupSelector(setting.controlEl);
            });

        new Setting(contentEl)
            .setName("Note liée")
            .setDesc("Double Clic pour y accéder")
            .then(setting => {
                setting.controlEl.empty();
                this.renderNoteInput(setting.controlEl);
            });


        /* ───────── COMMENTAIRE ───────── */
        contentEl.createEl("h3", { text: "- COMMENTAIRE -" });

        const textarea = contentEl.createEl("textarea");
        textarea.style.width = "100%";
        textarea.style.resize = "vertical";
        textarea.rows = 4;
        textarea.value = this.data.commentaire ?? "";
        textarea.oninput = () => (this.data.commentaire = textarea.value);

        /* ───────── FOOTER ───────── */
        const footer = contentEl.createDiv("modal-footer");

        if (this.isEdit()) {
            const deleteBtn = footer.createEl("button", {
                text: "Supprimer",
                cls: "mod-warning"
            });

            deleteBtn.onclick = () => {
                new ConfirmDeleteModal(
                    this.app,
                    "Supprimer définitivement ce contact ?",
                    async () => {
                        this.plugin.data.personnes =
                            this.plugin.data.personnes.filter(p => p.id !== this.data.id);

                        await this.plugin.savePluginData();
                        this.onSave();
                        this.close();
                    }
                ).open();
            };
        }

        const saveBtn = footer.createEl("button", {
            text: "Enregistrer",
            cls: "mod-cta"
        });

        saveBtn.onclick = async () => {
            await this.savePerson();
            await this.plugin.savePluginData(); // pour les personnes
            await this.plugin.saveSettings();   // pour les groupes, si tu les modifies ici
            this.onSave();                      // callback
            this.close();
        };
    }

    /* ───────────────────────────── */
    /* GROUPES (MULTI SELECT)        */
    /* ───────────────────────────── */
    private renderNativeGroupSelector(container: HTMLElement) {
        container.empty();

        const groupes = this.plugin.settings.groupes;
        const selected = new Set(this.data.groupes ?? []);

        /* ─── CHIPS SÉLECTIONNÉES ─── */
        if (selected.size > 0) {
            const selectedWrap = container.createDiv();
            selectedWrap.style.display = "flex";
            selectedWrap.style.flexWrap = "wrap";
            selectedWrap.style.gap = "4px";
            selectedWrap.style.marginBottom = "6px";

            selected.forEach(id => {
                const g = groupes.find(gr => gr.id === id);
                if (!g) return;

                const chip = selectedWrap.createDiv("setting-tag");
                chip.setText(`${g.emoji} ${g.label}`);

                const close = chip.createSpan();
                close.setText("✕");
                close.style.marginLeft = "6px";
                close.style.cursor = "pointer";

                close.onclick = () => {
                    selected.delete(id);
                    this.data.groupes = [...selected];
                    this.render();
                };
            });
        }

        /* ─── DROPDOWN NATIF ─── */
        const select = container.createEl("select");
        select.addClass("dropdown");
        select.style.width = "100%";

        const placeholder = select.createEl("option", {
            text: "Ajouter un groupe…",
            value: ""
        });
        placeholder.selected = true;

        groupes
            .filter(g => !selected.has(g.id))
            .forEach(g => {
                select.createEl("option", {
                    value: g.id,
                    text: `${g.emoji} ${g.label}`
                });
            });

        select.onchange = () => {
            if (!select.value) return;

            selected.add(select.value);
            this.data.groupes = [...selected];
            this.render();
        };
    }




    /* ───────────────────────────── */
    /* NOTE AVEC SUGGESTIONS         */
    /* ───────────────────────────── */
    private renderNoteInput(container: HTMLElement) {
        const files = this.app.vault.getMarkdownFiles();

        const wrapper = container.createDiv();
        wrapper.style.position = "relative";

        const input = wrapper.createEl("input", {
            type: "text",
            placeholder: "Rechercher une note…"
        });
        input.style.width = "100%";
        input.value = this.data.notePath ?? "";

        const suggestions = wrapper.createDiv();
        suggestions.style.position = "absolute";
        suggestions.style.top = "100%";
        suggestions.style.left = "0";
        suggestions.style.right = "0";
        suggestions.style.display = "none";
        suggestions.style.zIndex = "100";

        input.oninput = () => {
            const value = input.value.toLowerCase();
            suggestions.empty();

            if (!value) {
                suggestions.style.display = "none";
                return;
            }

            files
                .filter(f => f.path.toLowerCase().includes(value))
                .slice(0, 8)
                .forEach(f => {
                    const item = suggestions.createDiv("note-suggestion");
                    item.setText(f.path);
                    item.onclick = () => {
                        input.value = f.path;
                        this.data.notePath = f.path;
                        suggestions.style.display = "none";
                    };
                });

            suggestions.style.display = "block";
        };
    }

    /* ───────────────────────────── */
    private async savePerson() {
        const existing = this.plugin.data.personnes.find(p => p.id === this.data.id);

        if (existing) Object.assign(existing, this.data);
        else this.plugin.data.personnes.push(this.data as Personne);

        await this.plugin.savePluginData();
        this.plugin.refreshHouseViews();
        this.onSave();
    }

    private isEdit() {
        return this.plugin.data.personnes.some(p => p.id === this.data.id);
    }
}
