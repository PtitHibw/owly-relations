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

        // ─── HEADER ───
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
        this.plugin.data.personnes
            .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
            .forEach(p => this.renderPersonItem(p));



        // ─── DRAG FROM CONTACTS ───
        this.container.ondragover = e => e.preventDefault();
        this.container.ondrop = async e => {
            e.preventDefault();

            const id = e.dataTransfer?.getData("text/plain");
            const source = e.dataTransfer?.getData("source");

            if (!id) return;

            const person = this.plugin.data.personnes.find(p => p.id === id);
            if (!person) return;

            // ⛔ drag CONTACT → CONTACT = rien
            if (source === "contact") return;

            // ✅ drag BADGE → CONTACTS = sortir de la maison
            const from = person.pieceId ?? OUTSIDE_HOUSE;
            if (from === OUTSIDE_HOUSE) return;

            this.plugin.data.historique.push({
                id: Date.now().toString(),
                personneId: person.id,
                personneNom: getDisplayName(person),
                personneCouleur: person.couleur,
                pieceFrom: from,
                pieceTo: OUTSIDE_HOUSE,
                date: new Date().toISOString()
            });


            // Supprime la personne de la maison
            person.pieceId = undefined;
            await this.plugin.savePluginData();

            this.render(); // refresh panel
            this.plugin.app.workspace.iterateAllLeaves(leaf => {
                const view = leaf.view as any;
                if ("refresh" in view) view.refresh();
            });
        };
        const footer = content.createDiv("contacts-footer");

        // dans ContactsPanel.render() -> footer
        const addBtn = footer.createEl("button", { text: "+ Ajouter un contact" });
        addBtn.onclick = () =>
            new PersonModal(
                this.plugin.app,
                this.plugin,
                () => {
                    // Callback onSave
                    this.render(); // rafraîchit la liste des contacts
                    // Si tu veux aussi rafraîchir la maison, tu peux passer un callback depuis HouseView
                }
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


        // texte 
        const nameSpan = item.createSpan();
        const emojis = getPersonEmojis(this.plugin, p.groupes);
        nameSpan.setText(`${getDisplayName(p)} ${emojis}`);



        // boutons droite
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
                async () => {
                    p.pieceId = undefined;
                    this.plugin.data.personnes =
                        this.plugin.data.personnes.filter(person => person.id !== p.id);

                    await this.plugin.savePluginData();
                    this.render();

                    this.plugin.app.workspace.iterateAllLeaves(leaf => {
                        const view = leaf.view as any;
                        if ("refresh" in view) view.refresh();
                    });
                }
            ).open();
        };

        // draggable
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
