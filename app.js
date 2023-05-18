const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const { scrapePlayerInfo, getPlayerEloList, scrapeFideData } = require("./scraper");
const { convertToDate } = require("./convertToDate");

const prisma = new PrismaClient();
const app = express();

app.use(cors());

app.use(express.json());

app.get("/players", async (req, res) => {
  try {
    const players = await prisma.player.findMany();

    const playersWithLastElo = await Promise.all(players.map(async player => {
      // Get the latest elo for the player
      const lastEloData = await prisma.elo.findFirst({
        where: { playerId: player.fideId },
        orderBy: { date: 'desc' }
      });

      // Exclude the original elos from the player object
      //const { elos, ...playerData } = player;

      const { id, ...lastElo } = lastEloData || {};
      // Return player data with the latest elo
      return { ...player, lastElo };
    }));

    res.json(playersWithLastElo);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "An error occurred while fetching the players" });
  }
});

app.get("/test", async (req, res) => {
  let id = '651097982';
  const data = await scrapeFideData(id, 1);

  for (let i = 0; i < 3; i++) {
    let tournaments = data[i];
    for (let j = 0; j < tournaments.length; j++) {
      let tournament = tournaments[j];

      let existingTournament = await prisma.tournament.findFirst({
        where: {
          AND: [
            { name: tournament.title },
            { player: { fideId: parseInt(id) } },
            { date: convertToDate("2023-May") }
          ]
        }
      });

      if (!existingTournament) {
        const newTournament = await prisma.tournament.create({
          data: {
            player: {
              connect: {
                fideId: parseInt(id),
              },
            },
            name: tournament.title,
            date: convertToDate("2023-May"),
            timeControl: i==0 ? 'classical' : i==1 ? 'rapid' : 'blitz',
          },
        });

        let games = tournament.games;
        for (let k = 0; k < games.length; k++) {
          let game = games[k];

          const newGame = await prisma.game.create({
            data: {
              tournament: {
                connect: {
                  id: newTournament.id,
                },
              },
              OpponentName: game.opponentName,
              OpponentElo: parseInt(game.opponentElo),
              Result: parseFloat(game.result),
              change: parseFloat(game.kChange),
              color: game.color,
            },
          });
        }



      }
    }
  }







  res.json(data);
});

app.get("/players/:id", async (req, res) => {
  const { id } = req.params;
  const player = await prisma.player.findUnique({
    where: {
      id: parseInt(id),
    },
  });
  res.json(player);
});

app.post("/players", async (req, res) => {
  const { fideId } = req.body;

  const playerInfo = await scrapePlayerInfo(fideId);

  try {
    const player = await prisma.player.create({
      data: {
        fideId: parseInt(fideId),
        firstName: playerInfo.firstName,
        lastName: playerInfo.lastName,
        federation: playerInfo.federation,
        birthYear: parseInt(playerInfo.birthYear),
        sex: playerInfo.sex,
      },
    });

    res.status(201).json(player);
  } catch (error) {
    if (error.code === "P2002" && error.meta.target.includes("fideId")) {
      res
        .status(409)
        .json({ error: "A player with this FIDE ID already exists" });
    } else {
      console.log(error);
      res
        .status(500)
        .json({ error: "An error occurred while creating the player" });
    }
  }
  const eloInfo = await getPlayerEloList(fideId);


  console.log(eloInfo);

    // create elo records
    for (eloElem of eloInfo) {
      // Convert date to consistent format
      const eloDate = convertToDate(eloElem.period);
    
      // Check if ELO with the same date exists for the player
      const existingElo = await prisma.elo.findFirst({
        where: {
          AND: [
            { date: eloDate },
            { player: { fideId: parseInt(fideId) } }
          ]
        }
      });
    
      // Only create new ELO if it doesn't exist
      if (!existingElo) {
        const elo = await prisma.elo.create({
          data: {
            player: {
              connect: {
                fideId: parseInt(fideId),
              },
            },
            date: eloDate,
            classical: parseInt(eloElem.classical) ? parseInt(eloElem.classical) : null,
            rapid: parseInt(eloElem.rapid) ? parseInt(eloElem.rapid) : null,
            blitz: parseInt(eloElem.blitz) ? parseInt(eloElem.blitz) : null,
          },
        });
      }
    }

    // récupérer les tournois / games du dernier mois uniquement

    



});

app.get("/players/:id/games", async (req, res) => {
  const { id } = req.params;
  const games = await prisma.game.findMany({
    where: {
      tournament: {
        player: {
          fideId: parseInt(id),
        },
      },
    },
  });
  return res.json(games);
});


app.listen(3000, () => console.log("Server is running on port 3000"));
