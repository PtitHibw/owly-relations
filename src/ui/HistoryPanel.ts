import RelationshipHousePlugin from "../main";
import { getDisplayName } from "../data/personnes";
import { OUTSIDE_HOUSE } from "../data/constants";
import { getFullName } from "../data/constants";
import { HistoryCommentModal } from "./HistoryCommentModal";

type SearchItem =
    | { type: "person"; id: string; label: string }
    | { type: "group"; id: string; label: string; emoji: string };

export class HistoryPanel {
    private selectedPersonIds = new Set<string>();

    private searchInput!: HTMLInputElement;
    private suggestionsEl!: HTMLElement;
    private selectedWrapper!: HTMLElement;
    private listEl!: HTMLElement;
    private contentEl!: HTMLElement;

    constructor(
        private container: HTMLElement,
        private plugin: RelationshipHousePlugin,
        private onSelectionChange: (ids: Set<string>) => void
    ) { }

    // ───────── RENDER ─────────
    render() {
        this.container.empty();
        this.container.addClass("side-panel", "left", "history-panel");

        const header = this.container.createDiv("side-header");

        const toggleBtn = header.createEl("button", {
            cls: "collapse-btn",
            text: "◀"
        });
        toggleBtn.onclick = () => {
            const collapsed = this.container.classList.toggle("collapsed");
            toggleBtn.textContent = collapsed ? "▶" : "◀";
        };

        header.createDiv("side-title").setText("Historique");

        this.contentEl = this.container.createDiv("side-content");

        this.renderSearch();
        this.renderList();
        this.refreshHighlight();

        this.plugin.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") this.clearSelection();
        });


        this.plugin.registerDomEvent(document, "click", (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.closest(".history-panel") ||
                target.closest(".person-badge")
            ) return;

            this.clearSelection();
        });

    }

    clearSelection() {
        this.selectedPersonIds.clear();
        this.syncSelection();
    }

    // ───────── SEARCH ─────────
    renderSearch() {
        const wrapper = this.contentEl.createDiv("history-search");

        this.selectedWrapper = wrapper.createDiv("history-search-selected");

        this.searchInput = wrapper.createEl("input", {
            type: "text",
            placeholder: "Rechercher personne ou groupe…"
        });

        this.suggestionsEl = wrapper.createDiv("history-suggestions");
        

        this.searchInput.oninput = () => {
            const value = this.searchInput.value.toLowerCase();
            this.suggestionsEl.empty();

            if (!value) {
                this.suggestionsEl.removeClass("is-open");

                return;
            }

            this.getSearchItems()
                .filter(item => {
                    if (item.type === "person") {
                        return (
                            item.label.toLowerCase().includes(value) &&
                            !this.selectedPersonIds.has(item.id)
                        );
                    }

                    // groupe
                    return (
                        item.label.toLowerCase().includes(value) ||
                        item.emoji.includes(value) ||
                        value.includes("groupe")
                    );
                })
                .forEach(item => {
                    const el = this.suggestionsEl.createDiv("history-suggestion");
                    el.setText(item.label);
                    el.addClass(item.type === "group" ? "is-group" : "is-person");


                    el.onclick = e => {
                        e.stopPropagation();
                        this.onSearchItemSelected(item);
                    };
                });

            this.suggestionsEl.toggleClass("is-open", !!value);

        };
    }

    private onSearchItemSelected(item: SearchItem) {
        if (item.type === "person") {
            this.addPerson(item.id);
            return;
        }

        // GROUPE → ajouter toutes les personnes du groupe
        this.plugin.data.personnes
            .filter(p => p.groupes?.includes(item.id))
            .forEach(p => this.selectedPersonIds.add(p.id));

        this.syncSelection();
        this.searchInput.value = "";
        this.suggestionsEl.removeClass("is-open");

    }

    private addPerson(id: string) {
        if (this.selectedPersonIds.has(id)) return;
        this.selectedPersonIds.add(id);
        this.syncSelection();
    }

    renderSelectedBadges() {
        this.selectedWrapper.empty();

        this.selectedPersonIds.forEach(id => {
            const person = this.plugin.data.personnes.find(p => p.id === id);
            if (!person) return;

            const badge = this.selectedWrapper.createDiv("search-badge");
            badge.setText(getDisplayName(person));
            badge.addClass("search-badge")
            badge.style.backgroundColor = person.couleur ?? "#999"
            

            const close = badge.createSpan();
            close.setText("✕");
            close.addClass("close")

            close.onclick = e => {
                e.stopPropagation();
                this.selectedPersonIds.delete(id);
                this.syncSelection();
            };
        });
    }

    // ───────── LIST ─────────
    renderList() {
        this.listEl = this.contentEl.createDiv("history-list");

        [...this.plugin.data.historique].reverse().forEach(move => {
            const item = this.listEl.createDiv("history-item");
            item.dataset.personId = move.personneId;

            const person = this.plugin.data.personnes.find(p => p.id === move.personneId);
            const color = person?.couleur ?? move.personneCouleur ?? "#888";
            item.dataset.personColor = color;

            // ── Colonne 1 : Nom
            const nameEl = item.createDiv("history-person");
            nameEl.setText(person ? getDisplayName(person) : move.personneNom);

            // ── Colonne 2 : Déplacement + Date/Heure
            const detailsEl = item.createDiv("history-details");
            detailsEl.createDiv("history-move-line").setText(
                `${move.pieceFrom === OUTSIDE_HOUSE ? "CONTACTS" : move.pieceFrom} → ${move.pieceTo === OUTSIDE_HOUSE ? "CONTACTS" : move.pieceTo}`
            );
            const d = new Date(move.date);
            detailsEl.createDiv("history-date-line").setText(
                `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
            );

            // ── Colonne 3 : Commentaire
            const commentBtn = item.createDiv("history-comment-btn");
            commentBtn.setText("💬");
            commentBtn.addClass("history-comment-btn")
            
            commentBtn.toggleClass("inactive", !move.commentaire);



            commentBtn.onclick = e => {
                e.stopPropagation();
                new HistoryCommentModal(
                    this.plugin.app,
                    move.commentaire ?? "",
                    value => {
                        void (async () => {
                            move.commentaire = value || undefined;
                            await this.plugin.savePluginData();
                            this.render();
                        })();

                    }).open();
            };

            item.onclick = () => this.selectSinglePerson(move.personneId);
            item.setAttr("data-tooltip", person ? getFullName(person) : move.personneId);
            item.addClass("has-tooltip");
        });
    }




    
    // ───────── DATA ─────────
    getSearchItems(): SearchItem[] {
        const items: SearchItem[] = [];

        // Contacts existants
        this.plugin.data.personnes.forEach(p =>
            items.push({
                type: "person",
                id: p.id,
                label: getDisplayName(p)
            })
        );

        // Contacts supprimés mais présents dans l'historique
        this.plugin.data.historique.forEach(move => {
            // Si id déjà présent, ignore
            if (!items.some(i => i.type === "person" && i.id === move.personneId)) {
                items.push({
                    type: "person",
                    id: move.personneId,
                    label: move.personneNom
                });
            }
        });

        // Groupes
        this.plugin.settings.groupes.forEach(g =>
            items.push({
                type: "group",
                id: g.id,
                emoji: g.emoji,
                label: `${g.emoji} ${g.label} (Groupe)`
            })
        );

        return items;
    }


    // ───────── SYNC ─────────
    private syncSelection() {
        this.onSelectionChange(new Set(this.selectedPersonIds));
        this.renderSelectedBadges();
        this.refreshHighlight();
    }


    private refreshHighlight() {
        document.querySelectorAll(".history-item").forEach(el => {
            const id = el.getAttribute("data-person-id");
            const color = el.getAttribute("data-person-color") ?? "#888";

            // Couleur adoucie
            const rgba = this.hexToRgba(color, 0.2);

            el.classList.remove("is-dimmed", "is-highlighted", "highlighted-temp");

            if (!id || this.selectedPersonIds.size === 0) {
                return;
            }

            if (this.selectedPersonIds.has(id)) {
                el.classList.add("is-highlighted", "highlighted-temp");
                // applique couleur via variable CSS sur le parent (évite style direct)
                (el as HTMLElement).style.setProperty("--history-bg", rgba);
            } else {
                el.classList.add("is-dimmed");
            }
        });
    }


    // ───── UTILITAIRE ─────
    private hexToRgba(hex: string, alpha: number) {
        const trimmed = hex.replace("#", "");
        const bigint = parseInt(trimmed, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }


    selectSinglePerson(id: string) {
        this.selectedPersonIds.clear();
        this.selectedPersonIds.add(id);
        this.syncSelection();
    }
}
