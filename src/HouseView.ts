import { ItemView, WorkspaceLeaf, normalizePath } from "obsidian";
import RelationshipHousePlugin from "./main";
import { DEFAULT_PIECES } from "./data/pieces";
import { getDisplayName } from "./data/personnes";
import { OUTSIDE_HOUSE } from "./data/constants";
import { getFullName } from "./data/constants";
import { getPersonEmojis } from "./utils/groups";
import { HistoryPanel } from "./ui/HistoryPanel";
import { ContactsPanel } from "./ui/ContactsPanel";
import { openPersonNote } from "./utils/openPersonNote";
import { TFile } from "obsidian";


export const VIEW_TYPE_HOUSE = "relationship-house-view";

export class HouseView extends ItemView {
	private historyPanel!: HistoryPanel;

	// ───────── ZOOM / PAN / STATUS ─────────
	private svgWrapper!: HTMLDivElement;
	private svgScale = 1;
	private svgOffset = { x: 0, y: 0 };
	private isPanning = false;
	private panStart = { x: 0, y: 0 };
	private statusBar!: HTMLDivElement;

	constructor(
		leaf: WorkspaceLeaf,
		private assetsPath: string,
		private plugin: RelationshipHousePlugin
	) {
		super(leaf);
	}

	getViewType() { return VIEW_TYPE_HOUSE; }
	getDisplayText() { return "Maison des relations"; }

	public async refresh() { await this.onOpen(); }

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("relationship-house-container");

		const layout = container.createDiv("house-layout");

		// ─── HISTORY PANEL ───
		const historyContainer = layout.createDiv("side-panel left");
		this.historyPanel = new HistoryPanel(
			historyContainer,
			this.plugin,
			ids => this.refreshBadgeHighlight(ids)
		);
		this.historyPanel.render();

		// ─── HOUSE SVG ───
		const houseContainer = layout.createDiv("house-wrapper");
		await this.renderHouse(houseContainer);

		// ─── CONTACTS PANEL ───
		const contactsContainer = layout.createDiv("side-panel right");
		const contacts = new ContactsPanel(contactsContainer, this.plugin);
		contacts.render();
	}

	async renderHouse(container: HTMLElement) {
		const svgPath = normalizePath(this.assetsPath + "/house.svg");
		// Asset du plugin → hors vault → adapter.read obligatoire
		const svg = await this.app.vault.adapter.read(svgPath);


		// ───────── SVG WRAPPER ─────────
		this.svgWrapper = container.createDiv("house-svg-wrapper");
		
		const parser = new DOMParser();
		const doc = parser.parseFromString(svg, "image/svg+xml");

		const svgEl = doc.querySelector("svg");
		if (!svgEl) {
			throw new Error("SVG invalide : élément <svg> introuvable");
		}

		const importedSvg = document.importNode(svgEl, true);

		this.svgWrapper.appendChild(importedSvg);


		const overlay = this.svgWrapper.createDiv("house-overlay");
		
		const pieceTooltip = document.body.createDiv("piece-tooltip");
		

		// ───────── STATUS BAR + ZOOM CONTROLS ─────────
		const statusZoomContainer = container.createDiv("house-status-bar");

		
		// Zoom buttons +/-
		["+", "-"].forEach(text => {
			const btn = statusZoomContainer.createEl("button");
			btn.setText(text);
			btn.addClass("house-zoom-btn");
			btn.onclick = () => this.zoomSVG(text === "+" ? 1.1 : 0.9);
		});

		// Divider
		const divider1 = statusZoomContainer.createDiv("house-zoom-divider");
		divider1.setText("|");

		// Reset button
		const resetBtn = statusZoomContainer.createEl("button");
		resetBtn.setText("Reset");
		resetBtn.addClass("house-zoom-btn");
		resetBtn.onclick = () => {
			this.svgScale = 1;
			this.svgOffset = { x: 0, y: 0 };
			this.updateSVGTransform();
		};

		// Divider
		const divider2 = statusZoomContainer.createDiv("house-zoom-divider");
		divider2.setText("|");

		// Status / Coordinates
		this.statusBar = statusZoomContainer.createDiv("house-coordinates");
		this.statusBar.setText("X: -, Y: -");

		// ───────── COORDS QUI PRENNENT EN COMPTE ZOOM + PAN ─────────
		this.svgWrapper.onmousemove = e => {
			
			const svgEl = this.svgWrapper.querySelector("svg")!;
			const pt = svgEl.createSVGPoint();
			pt.x = e.clientX;
			pt.y = e.clientY;
			const svgCoords = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
			const svgX = svgCoords.x;
			const svgY = svgCoords.y;


			this.statusBar.setText(`X: ${Math.round(svgX)}, Y: ${Math.round(svgY)}`);
		};



		this.svgWrapper.onmouseleave = () => {
			this.statusBar.setText("X: -, Y: -");
		};

		// ───────── SCROLL ZOOM ─────────
		this.svgWrapper.onwheel = e => {
			e.preventDefault();
			const factor = e.deltaY > 0 ? 0.9 : 1.1;
			this.zoomSVG(factor, e.clientX, e.clientY);
		};

		// ───────── PAN MIDDLE CLICK ─────────
		this.svgWrapper.onmousedown = e => {
			if (e.button === 1) {
				e.preventDefault();
				this.isPanning = true;
				this.panStart = { x: e.clientX - this.svgOffset.x, y: e.clientY - this.svgOffset.y };
				this.svgWrapper.addClass("is-panning");

			}
		};

		this.plugin.registerDomEvent(document, "mouseup", e => {
			if (this.isPanning) {
				this.isPanning = false;
				this.svgWrapper.removeClass("is-panning");

			}
		});

		this.plugin.registerDomEvent(document, "mousemove", e => {
			if (!this.isPanning) return;
			this.svgOffset.x = e.clientX - this.panStart.x;
			this.svgOffset.y = e.clientY - this.panStart.y;
			this.updateSVGTransform();
		});

		this.updateSVGTransform();

		// ───────── BADGES ─────────
		const personnes = this.plugin.data.personnes;
		
		DEFAULT_PIECES.forEach(piece => {
			const settingsPiece = this.plugin.settings.pieces?.find(p => p.id === piece.id);

			if (settingsPiece?.visible === false) return;


			const pieceEl = overlay.createDiv("house-piece");
			pieceEl.style.left = piece.x + "px";
			pieceEl.style.top = piece.y + "px";
			pieceEl.style.width = piece.width + "px";
			pieceEl.style.height = piece.height + "px";



			if (settingsPiece?.description) {
				pieceEl.oncontextmenu = (e) => {
					e.preventDefault();
					pieceTooltip.setText(settingsPiece.description ?? "");
					pieceTooltip.style.left = e.clientX + 12 + "px";
					pieceTooltip.style.top = e.clientY + 12 + "px";
					pieceTooltip.style.display = "block";
				};
			}
			this.plugin.registerDomEvent(document, "click", () => {
				pieceTooltip.style.display = "none";
			});


			// Label de la pièce
			const labelEl = pieceEl.createDiv("piece-label");
			labelEl.setText(settingsPiece?.label ?? piece.nom);
			

			// Container pour badges
			const badgesContainer = pieceEl.createDiv("house-badges");


			pieceEl.ondragover = e => e.preventDefault();
			pieceEl.ondrop = async e => {
				e.preventDefault();
				const id = e.dataTransfer?.getData("text/plain");
				if (!id) return;
				const person = personnes.find(p => p.id === id);
				if (!person || person.pieceId === piece.id) return;

				const from = person.pieceId ?? OUTSIDE_HOUSE;
				const to = piece.id;
				if (from === to) return;

				this.plugin.data.historique.push({
					id: Date.now().toString(),
					personneId: person.id,
					personneNom: getDisplayName(person),
					personneCouleur: person.couleur,
					pieceFrom: from,
					pieceTo: to,
					date: new Date().toISOString(),
				});

				person.pieceId = to;
				await this.plugin.savePluginData();
				this.onOpen();
			};

			personnes.filter(p => p.pieceId === piece.id).forEach(p => {
				const badge = badgesContainer.createDiv("person-badge");
				badge.setText(`${getDisplayName(p)} ${getPersonEmojis(this.plugin, p.groupes)}`);
				badge.style.backgroundColor = p.couleur ?? "gray";
				badge.setAttr("draggable", "true");
				badge.dataset.personId = p.id;
				badge.setAttr("data-tooltip", getFullName(p));
				badge.addClass("has-tooltip");

				badge.ondragstart = e => {
					e.dataTransfer?.setData("text/plain", p.id);
					e.dataTransfer?.setData("source", "badge");
				};
				badge.onclick = e => { e.stopPropagation(); this.historyPanel.selectSinglePerson(p.id); };
				badge.ondblclick = e => { e.stopPropagation(); openPersonNote(this.app, p); };
			});

		});
	}


	private zoomSVG(factor: number, centerX?: number, centerY?: number) {
		if (centerX !== undefined && centerY !== undefined) {
			const rect = this.svgWrapper.getBoundingClientRect();

			// Coordonnées du curseur relative au SVG
			const svgCursorX = (centerX - rect.left - this.svgOffset.x) / this.svgScale;
			const svgCursorY = (centerY - rect.top - this.svgOffset.y) / this.svgScale;

			// Ajuste l'offset pour que le point sous le curseur reste fixe
			this.svgOffset.x -= (factor - 1) * svgCursorX * this.svgScale;
			this.svgOffset.y -= (factor - 1) * svgCursorY * this.svgScale;
		}

		this.svgScale *= factor;
		this.updateSVGTransform();
	}



	private updateSVGTransform() {
		this.svgWrapper.style.transform = `translate(${this.svgOffset.x}px, ${this.svgOffset.y}px) scale(${this.svgScale})`;
		this.svgWrapper.style.transformOrigin = "0 0";
	}

	refreshBadgeHighlight(selectedIds: Set<string>) {
		this.contentEl.querySelectorAll(".person-badge").forEach(el => {
			const id = el.getAttribute("data-person-id");
			if (!id) return;
			if (selectedIds.size === 0) el.classList.remove("is-dimmed", "is-highlighted");
			else if (selectedIds.has(id)) { el.classList.add("is-highlighted"); el.classList.remove("is-dimmed"); }
			else { el.classList.add("is-dimmed"); el.classList.remove("is-highlighted"); }
		});
	}
}
