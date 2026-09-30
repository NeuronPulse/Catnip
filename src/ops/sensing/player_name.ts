/**
 * The player name the `username` block reads. Hosts that have one (an editor
 * login) call setPlayerName; the playground defaults to Scratch's standalone
 * empty string.
 */
let playerName = "";

export function setPlayerName(name: string): void {
    playerName = name;
}

export function getPlayerName(): string {
    return playerName;
}
