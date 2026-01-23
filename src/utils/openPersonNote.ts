import { App, Notice } from "obsidian";
import { Personne } from "../data/personnes";

export function openPersonNote(app: App, person?: Personne) {
    if (!person || !person.notePath) {
        new Notice("Aucune note associée");
        return;
    }

    void app.workspace.openLinkText(
        person.notePath,
        "",
        true
    );
}
