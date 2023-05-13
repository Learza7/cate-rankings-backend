const express = require("express");
const { PrismaClient } = require("@prisma/client");

const { scrapePlayerInfo, getPlayerEloList } = require("./scraper");
const { convertToDate } = require("./convertToDate");

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

app.get("/players", async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
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



});

app.get("/players/:id/elo", async (req, res) => {
  const { id } = req.params;
  const elo = await prisma.elo.findMany({
    where: {
      playerId: parseInt(id),
    },
  });
  return res.json(elo);
});


app.listen(3000, () => console.log("Server is running on port 3000"));
