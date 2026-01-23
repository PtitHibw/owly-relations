import { App, Modal } from "obsidian";

export class HistoryCommentModal extends Modal {
    constructor(
        app: App,
        private initial: string,
        private onSave: (value: string) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText("Commentaire");

        const textarea = contentEl.createEl("textarea");
        textarea.addClass("history-comment-textarea");
        textarea.value = this.initial ?? "";
        textarea.focus();


        const footer = contentEl.createDiv("modal-footer");

        const save = footer.createEl("button", {
            text: "Enregistrer",
            cls: "mod-cta"
        });

        save.onclick = () => {
            this.onSave(textarea.value.trim());
            this.close();
        };
    }
}
