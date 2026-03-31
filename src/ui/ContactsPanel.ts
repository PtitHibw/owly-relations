import RelationshipHousePlugin from "../main";
import { Personne } from "../data/personnes";
import { PersonModal } from "./PersonModal";
import { OUTSIDE_HOUSE } from "../data/constants";
import { getFullName } from "../data/constants";
import { getDisplayName } from "../data/personnes";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { getPersonEmojis } from "../utils/groups";
import { openPersonNote } from "../utils/openPersonNote";

export class ContactsPanel {
    private searchInput!: HTMLInputElement;
    private listEl!: HTMLElement;
    private selectedIds = new Set<string>();
    private suggestionsEl!: HTMLElement;
    private selectedWrapper!: HTMLElement;

    constructor(
        private container: HTMLElement,
        private plugin: RelationshipHousePlugin
    ) { }

    render() {
        this.container.empty();
        this.container.addClass("side-panel", "right");

        const header = this.container.createDiv("side-header");

        const toggleBtn = header.createEl("button", {
            cls: "collapse-btn",
            text: "▶"
        });
        toggleBtn.onclick = () => {
            const collapsed = this.container.classList.toggle("collapsed");
            toggleBtn.textContent = collapsed ? "◀" : "▶";
        };
        const title = header.createDiv("side-title");
        title.setText("Contacts");

        const content = this.container.createDiv("side-content");
        this.listEl = content.createDiv("contacts-list");

        // ─── RENDER CONTACTS ───
        const maison = this.plugin.getActiveMaison();
        maison.personnes
            .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
            .forEach(p => this.renderPersonItem(p));

        // ─── DRAG FROM CONTACTS ───
        this.container.ondragover = e => e.preventDefault();
        this.container.ondrop = async e => {
            e.preventDefault();

            const id = e.dataTransfer?.getData("text/plain");
            const source = e.dataTransfer?.getData("source");
            if (!id) return;

            const maison = this.plugin.getActiveMaison();
            const person = maison.personnes.find(p => p.id === id);
            if (!person) return;

            // drag CONTACT → CONTACT = rien
            if (source === "contact") return;

            // drag BADGE → CONTACTS = sortir de la maison
            const from = person.pieceId ?? OUTSIDE_HOUSE;
            if (from === OUTSIDE_HOUSE) return;

            maison.historique.push({
                id: Date.now().toString(),
                personneId: person.id,
                personneNom: getDisplayName(person),
                personneCouleur: person.couleur,
                pieceFrom: from,
                pieceTo: OUTSIDE_HOUSE,
                date: new Date().toISOString()
            });

            person.pieceId = undefined;
            await this.plugin.savePluginData();

            this.render();
            this.plugin.app.workspace.iterateAllLeaves(leaf => {
                const view = leaf.view;
                if ("refresh" in view) {
                    (view as { refresh: () => void }).refresh();
                }
            });
        };

        const footer = content.createDiv("contacts-footer");
        const label = "+ Ajouter un contact";
        const addBtn = footer.createEl("button", { text: label });
        addBtn.onclick = () =>
            new PersonModal(
                this.plugin.app,
                this.plugin,
                () => { this.render(); }
            ).open();
    }

    private renderPersonItem(p: Personne) {
        const item = this.listEl.createDiv("contact-item") as HTMLElement;
        item.dataset.personId = p.id;
        item.dataset.personName = getDisplayName(p) ?? "";
        item.style.borderLeft = `4px solid ${p.couleur ?? "#999"}`;
        item.setAttr("data-tooltip", getFullName(p));
        item.addClass("has-tooltip");
        item.ondblclick = e => {
            e.stopPropagation();
            openPersonNote(this.plugin.app, p);
        };

        const nameSpan = item.createSpan();
        nameSpan.setText(`${getDisplayName(p)} ${getPersonEmojis(this.plugin, p.groupes)}`);

        const buttonsWrapper = item.createDiv("buttons-wrapper");

        const editBtn = buttonsWrapper.createEl("button", { text: "✎" });
        editBtn.onclick = e => {
            e.stopPropagation();
            new PersonModal(
                this.plugin.app,
                this.plugin,
                () => this.render(),
                p
            ).open();
        };

        const deleteBtn = buttonsWrapper.createEl("button", { text: "🗑" });
        deleteBtn.onclick = e => {
            e.stopPropagation();
            new ConfirmDeleteModal(
                this.plugin.app,
                `Supprimer le contact « ${getDisplayName(p)} » ?`,
                () => {
                    void (async () => {
                        const maison = this.plugin.getActiveMaison();

                        // Expulsion si dans une pièce
                        if (p.pieceId) {
                            maison.historique.push({
                                id: Date.now().toString(),
                                personneId: p.id,
                                personneNom: getDisplayName(p),
                                personneCouleur: p.couleur,
                                pieceFrom: p.pieceId,
                                pieceTo: OUTSIDE_HOUSE,
                                date: new Date().toISOString(),
                            });
                        }

                        maison.personnes = maison.personnes.filter(person => person.id !== p.id);

                        await this.plugin.savePluginData();
                        this.render();

                        this.plugin.app.workspace.iterateAllLeaves(leaf => {
                            const view = leaf.view;
                            if ("refresh" in view) (view as { refresh: () => void }).refresh();
                        });
                    })();
                }
            ).open();
        };

        item.setAttr("draggable", "true");
        item.ondragstart = e => {
            e.dataTransfer?.setData("text/plain", p.id);
            e.dataTransfer?.setData("source", "contact");
        };
    }

    renderContactsFilter() {
        this.listEl.querySelectorAll(".contact-item").forEach(el => {
            const id = el.getAttribute("data-person-id");
            if (!id) return;
            if (this.selectedIds.size === 0 || this.selectedIds.has(id)) {
                el.removeAttribute("hidden");
            } else {
                el.setAttribute("hidden", "true");
            }
        });
    }
}