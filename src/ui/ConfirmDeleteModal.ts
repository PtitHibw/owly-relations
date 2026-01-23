import { App, Modal } from "obsidian";

export class ConfirmDeleteModal extends Modal {
    constructor(
        app: App,
        private message: string,
        private onConfirm: () => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText("Confirmer la suppression");

        contentEl.createEl("p", { text: this.message });

        const buttons = contentEl.createDiv({ cls: "modal-footer" });

        const cancel = buttons.createEl("button", { text: "Annuler" });
        cancel.onclick = () => this.close();

        const confirm = buttons.createEl("button", {
            text: "Supprimer",
            cls: "mod-warning"
        });
        confirm.onclick = () => {
            this.onConfirm();
            this.close();
        };
    }
}
