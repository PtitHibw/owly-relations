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
		const svg = await this.app.vault.adapter.read(svgPath);

		// ───────── SVG WRAPPER ─────────
		this.svgWrapper = container.createDiv("house-svg-wrapper");
		this.svgWrapper.innerHTML = svg;
		Object.assign(this.svgWrapper.style, {
			position: "relative",
			overflow: "hidden",
		});

		const overlay = this.svgWrapper.createDiv("house-overlay");
		overlay.style.position = "absolute";
		overlay.style.inset = "0";


		const pieceTooltip = document.body.createDiv("piece-tooltip");
		Object.assign(pieceTooltip.style, {
			position: "fixed",
			display: "none",
			pointerEvents: "none",
			zIndex: "9999",
			background: "var(--background-secondary)",
			color: "var(--text-normal)",
			padding: "4px 6px",
			borderRadius: "4px",
			fontSize: "12px",
			maxWidth: "240px",
			whiteSpace: "pre-wrap",
		});


		// ───────── STATUS BAR + ZOOM CONTROLS ─────────
		const statusZoomContainer = container.createDiv();
		Object.assign(statusZoomContainer.style, {
			position: "absolute",
			bottom: "4px",
			left: "50%",
			transform: "translateX(-50%)",
			display: "flex",
			alignItems: "center",
			gap: "6px",
			zIndex: "1000",
			background: "var(--background-secondary-alt)",
			padding: "2px 6px",
			borderRadius: "4px",
		});

		// Zoom buttons +/-
		["+", "-"].forEach(text => {
			const btn = statusZoomContainer.createEl("button");
			btn.setText(text);
			Object.assign(btn.style, {
				padding: "2px 4px",
				fontSize: "12px",
				cursor: "pointer",
			});
			btn.onclick = () => this.zoomSVG(text === "+" ? 1.1 : 0.9);
		});

		// Divider
		const divider1 = statusZoomContainer.createDiv();
		divider1.setText("|");
		Object.assign(divider1.style, { opacity: "0.5", fontWeight: "bold" });

		// Reset button
		const resetBtn = statusZoomContainer.createEl("button");
		resetBtn.setText("Reset");
		Object.assign(resetBtn.style, {
			padding: "2px 4px",
			fontSize: "12px",
			cursor: "pointer",
		});
		resetBtn.onclick = () => {
			this.svgScale = 1;
			this.svgOffset = { x: 0, y: 0 };
			this.updateSVGTransform();
		};

		// Divider
		const divider2 = statusZoomContainer.createDiv();
		divider2.setText("|");
		Object.assign(divider2.style, { opacity: "0.5", fontWeight: "bold" });

		// Status / Coordinates
		this.statusBar = statusZoomContainer.createDiv();
		Object.assign(this.statusBar.style, {
			fontSize: "12px",
			color: "var(--text-normal)",
		});
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
				this.svgWrapper.style.cursor = "grabbing";
			}
		};

		document.onmouseup = () => {
			if (this.isPanning) {
				this.isPanning = false;
				this.svgWrapper.style.cursor = "crosshair";
			}
		};

		document.onmousemove = e => {
			if (!this.isPanning) return;
			this.svgOffset.x = e.clientX - this.panStart.x;
			this.svgOffset.y = e.clientY - this.panStart.y;
			this.updateSVGTransform();
		};

		this.updateSVGTransform();

		// ───────── BADGES ─────────
		const personnes = this.plugin.data.personnes;
		
		DEFAULT_PIECES.forEach(piece => {
			const settingsPiece = this.plugin.settings.pieces?.find(p => p.id === piece.id);

			// pièce masquée → on ne la rend pas
			if (settingsPiece?.visible === false) return;


			const pieceEl = overlay.createDiv("house-piece");
			Object.assign(pieceEl.style, {
				left: piece.x + "px",
				top: piece.y + "px",
				width: piece.width + "px",
				height: piece.height + "px",
				display: "flex",
				flexDirection: "column",  // label au-dessus, badges en dessous
				gap: "4px",
				padding: "4px",
				border: `2px dashed ${"rgba(76, 76, 76, 0.29)"}`,
				borderRadius: "8px",
				background: "rgba(167, 167, 167, 0.05)",
			});


			if (settingsPiece?.description) {
				pieceEl.oncontextmenu = (e) => {
					e.preventDefault();
					pieceTooltip.setText(settingsPiece.description ?? "");
					pieceTooltip.style.left = e.clientX + 12 + "px";
					pieceTooltip.style.top = e.clientY + 12 + "px";
					pieceTooltip.style.display = "block";
				};
			}
			document.addEventListener("click", () => {
				pieceTooltip.style.display = "none";
			});




			// Label de la pièce
			const labelEl = pieceEl.createDiv("piece-label");
			labelEl.setText(settingsPiece?.label ?? piece.nom);
			labelEl.style.margin = "0";


			// Container pour badges
			const badgesContainer = pieceEl.createDiv();
			Object.assign(badgesContainer.style, {
				display: "flex",
				flexWrap: "wrap",
				gap: "4px",
			});

			pieceEl.style.border = `2px dashed ${"rgba(76,76,76,0.29)"}`;
			pieceEl.style.background = "rgba(167,167,167,0.05)";




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
