import { App, Modal, Setting } from "obsidian";
import RelationshipHousePlugin from "../main";
import { Personne } from "../data/personnes";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
/* eslint-disable obsidianmd/ui/sentence-case */
/* eslint-disable @typescript-eslint/no-misused-promises */

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
        new Setting(contentEl)
            .setName("- IDENTITÉ -")
            .setHeading();

        
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
        new Setting(contentEl)
            .setName("- INFORMATIONS -")
            .setHeading();


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
        new Setting(contentEl)
            .setName("- COMMENTAIRE -")
            .setHeading();


        const textarea = contentEl.createEl("textarea");
        textarea.addClass("person-comment");
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
            const selectedWrap = container.createDiv("group-selected-wrap");


            selected.forEach(id => {
                const g = groupes.find(gr => gr.id === id);
                if (!g) return;

                const chip = selectedWrap.createDiv("setting-tag");
                chip.setText(`${g.emoji} ${g.label}`);

                const close = chip.createSpan("group-chip-close");
                close.setText("✕");


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
        select.addClass("group-select");


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

        const wrapper = container.createDiv("note-input-wrapper");

        const input = wrapper.createEl("input", {
            type: "text",
            placeholder: "Rechercher une note…"
        });
        input.addClass("note-input");
        input.value = this.data.notePath ?? "";

        const suggestions = wrapper.createDiv("note-suggestions");

        input.oninput = () => {
            const value = input.value.toLowerCase();
            suggestions.empty();

            if (!value) {
                suggestions.removeClass("is-open");
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
                        suggestions.removeClass("is-open");

                    };
                });

            suggestions.addClass("is-open");
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
