import RelationshipHousePlugin from "../main";


export function getPersonEmojis(plugin: RelationshipHousePlugin, groupes?: string[]): string {
    return (groupes ?? [])
        .map(id => plugin.settings.groupes.find(g => g.id === id)?.emoji)
        .filter(Boolean)
        .join("");
}