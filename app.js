const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const { scrapePlayerInfo, getPlayerEloList, scrapeFideData, getPlayerLastElo } = require("./scraper");
const { convertToDate } = require("./convertToDate");

const prisma = new PrismaClient();
const app = express();

const winston = require("winston");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "app.log" }),
  ],
});


const convertStringToDate = (dateString) => {
  const [month, year] = dateString.split(' ');
  const monthMap = {
    January: '01',
    February: '02',
    March: '03',
    April: '04',
    May: '05',
    June: '06',
    July: '07',
    August: '08',
    September: '09',
    October: '10',
    November: '11',
    December: '12'
  };

  const monthNumber = monthMap[month];

  const newDateString = `${year}-${monthNumber}-01`;

  return new Date(newDateString);
}



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
  let id = '551004240';
  const data = await scrapeFideData(id, 1);
  logger.info(data);

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
        existingTournament = await prisma.tournament.create({
          data: {
            player: {
              connect: {
                fideId: parseInt(id),
              },
            },
            name: tournament.title,
            date: convertToDate("2023-May"),
            timeControl: i == 0 ? 'classical' : i == 1 ? 'rapid' : 'blitz',
          },
        });
      }

      logger.info(existingTournament.id);



      let games = tournament.games;
      for (let k = 0; k < games.length; k++) {
        let game = games[k];

        const newGame = await prisma.game.create({
          data: {
            tournament: {
              connect: {
                id: existingTournament.id,
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


app.get("/games/updateAll", async (req, res) => {
  const players = await prisma.player.findMany();



  for (let i = 0; i < players.length; i++) {
    let id = players[i].fideId;


    const {
      period,
      data,
    } = await scrapeFideData(id, 1);

    logger.info("Processing player " + id + " for period " + period)

    for (let i = 0; i < 3; i++) {
      let tournaments = data[i];
      for (let j = 0; j < tournaments.length; j++) {
        let tournament = tournaments[j];

        let existingTournament = await prisma.tournament.findFirst({
          where: {
            AND: [
              { name: tournament.title },
              { player: { fideId: parseInt(id) } },
              { date: convertStringToDate(period) }
            ]
          }
        });

        if (!existingTournament) {
          existingTournament = await prisma.tournament.create({
            data: {
              player: {
                connect: {
                  fideId: parseInt(id),
                },
              },
              name: tournament.title,
              date: convertStringToDate(period),
              timeControl: i == 0 ? 'classical' : i == 1 ? 'rapid' : 'blitz',
            },
          });
          let games = tournament.games;
          for (let k = 0; k < games.length; k++) {
            let game = games[k];

            const newGame = await prisma.game.create({
              data: {
                tournament: {
                  connect: {
                    id: existingTournament.id,
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



  }
  return res.json({ message: "ok" });

});

app.get("/elos", (req, res) => {
  res.send("Welcome to the Elos endpoint!");
});

app.get("/elos/updateAll", async  (req, res) => {
  logger.info("Updating all elos");
  const players = await prisma.player.findMany();
  for (let i = 0; i < players.length; i++) {

    const {
      period,
      classical,
      rapid,
      blitz
    } = await getPlayerLastElo(players[i].fideId);

    logger.info("Processing player " + players[i].fideId + " for period " + period)

    const existingElo = await prisma.elo.findFirst({
      where: {
        AND: [
          { player: { fideId: parseInt(players[i].fideId) } },
          { date: convertToDate(period) }
        ]
      }


    });

    if (!existingElo) {
      const newElo = await prisma.elo.create({
        data: {
          player: {
            connect: {
              fideId: parseInt(players[i].fideId),
            },
          },
          date: convertToDate(period),
          classical: parseInt(classical),
          rapid: parseInt(rapid),
          blitz: parseInt(blitz),
        },
      });
    }
  }
  return res.json({ message: "ok" });
});


// create a new player
// and create all elos for the player
app.post("/players", async (req, res) => {
  const { fideId } = req.body;

  const playerInfo = await scrapePlayerInfo(fideId);
  logger.info(fideId)
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

app.get("/players/:id/tournaments", async (req, res) => {
  const { id } = req.params;

  const tournaments = await prisma.tournament.findMany({
    where: {
      player: {
        fideId: parseInt(id),
      },
    },
    include: {
      games: true,
    },
  });
  return res.json(tournaments);
  
});


app.listen(3000, () => console.log("Server is running on port 3000"));
