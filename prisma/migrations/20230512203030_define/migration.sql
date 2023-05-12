/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "players" (
    "fideId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "federation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "elos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "classical" INTEGER,
    "rapid" INTEGER,
    "blitz" INTEGER,
    "playerId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "elos_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("fideId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "timeControl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "tournaments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("fideId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "games" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "color" TEXT NOT NULL,
    "OpponentName" TEXT NOT NULL,
    "OpponentElo" INTEGER NOT NULL,
    "Result" REAL NOT NULL,
    "change" REAL NOT NULL
);
