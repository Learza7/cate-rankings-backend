/*
  Warnings:

  - Added the required column `tournamentId` to the `games` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "color" TEXT NOT NULL,
    "OpponentName" TEXT NOT NULL,
    "OpponentElo" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "Result" REAL NOT NULL,
    "change" REAL NOT NULL,
    CONSTRAINT "games_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_games" ("OpponentElo", "OpponentName", "Result", "change", "color", "id") SELECT "OpponentElo", "OpponentName", "Result", "change", "color", "id" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
