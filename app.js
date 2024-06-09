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
  const [year, month] = dateString.split('-');
  const monthMap = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  const monthNumber = monthMap[month];

  const newDateString = `${year}-${monthNumber}-01`;

  return newDateString;
}



app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to CATE RANKINGS" });
});

app.get("/players", async (req, res) => {
  logger.info("Endpoint /players called. Calling prisma...")
  try {
    const players = await prisma.player.findMany();
    
    logger.info("Prisma returned " + players.length + " players");

    const playersWithLastElo = await Promise.all(players.map(async player => {

      let req = await fetch(`https://ratings.fide.com/a_chart_data.phtml?event=${player.fideId}&period=0`, {
        "headers": {
          "accept": "*/*",
          "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6",
          "x-requested-with": "XMLHttpRequest",
          "Referer": "https://ratings.fide.com/profile/651097982/chart",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "POST"
      });

      let data = await req.json();

      const thisMonth = convertStringToDate(data[data.length - 1].date_2);



      const tournaments = await Promise.all([0, 1, 2].map(async i => {
        let q = await fetch(`https://ratings.fide.com/a_indv_calculations.php?id_number=${player.fideId}&rating_period=${thisMonth}&t=${i}`);
        //res content type is html
        logger.info(q)

        
        let text = await q.text();

        logger.info(text);

        return text;
      }));


    return {
    ...player,
    classical: data[data.length - 1]?.rating || null,
    rapid: data[data.length - 1]?.rapid_rtng || null,
    blitz: data[data.length - 1]?.blitz_rtng || null,
    classicalVariation: (data[data.length - 1]?.rating - data[data.length - 2]?.rating) || 0,
    rapidVariation: (data[data.length - 1]?.rapid_rtng - data[data.length - 2]?.rapid_rtng) || 0,
    blitzVariation: (data[data.length - 1]?.blitz_rtng - data[data.length - 2]?.blitz_rtng) || 0,
    tournaments: tournaments,
}}
    ))


    res.json(playersWithLastElo);
    // const playersWithLastElo = await Promise.all(players.map(async player => {
    //   // Get the latest elo for the player
    //   const firstTwoElos = await prisma.elo.findMany({
    //     where: { playerId: player.fideId },
    //     orderBy: { date: 'desc' },
    //     take: 2
    //   });

    //   // Exclude the original elos from the player object
    //   //const { elos, ...playerData } = player;

    //   const {
    //     date,
    //     classical,
    //     rapid,
    //     blitz,
    //   } = firstTwoElos[0] || {};

    //   const classicalVariation = firstTwoElos[0].classical - firstTwoElos[1].classical;
    //   const rapidVariation = firstTwoElos[0].rapid - firstTwoElos[1].rapid;
    //   const blitzVariation = firstTwoElos[0].blitz - firstTwoElos[1].blitz;

    //   // Return player data with the latest elo
    //   return { ...player, date, classical, rapid, blitz, classicalVariation, rapidVariation, blitzVariation };
    // }));

    // res.json(playersWithLastElo);
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

  res.json({ message: "Updating all games" });

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
  // return res.json({ message: "ok" });

});

app.get("/elos", (req, res) => {
  res.send("Welcome to the Elos endpoint!");
});

app.get("/elos/updateAll", async (req, res) => {
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

  const latestTournamentDate = await prisma.tournament.findFirst({
    where: {
      // player: {
      //   fideId: parseInt(id),
      // },
    },
    orderBy: {
      date: 'desc',
    },
    select: {
      date: true,
    },
  });

  const lastMonthStartDate = new Date(latestTournamentDate.date);
  console.log(lastMonthStartDate);
  // lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1);
  // lastMonthStartDate.setDate(1);
  // lastMonthStartDate.setHours(0, 0, 0, 0);

  const tournaments = await prisma.tournament.findMany({
    where: {
      player: {
        fideId: parseInt(id),
      },
      date: {
        gte: lastMonthStartDate.toISOString(),
      },
    },
    include: {
      games: true,
    },
  });

  const groupedTournaments = {
    classical: [],
    rapid: [],
    blitz: [],
  };

  tournaments.forEach(tournament => {
    switch (tournament.timeControl) {
      case 'classical':
        groupedTournaments.classical.push(tournament);
        break;
      case 'rapid':
        groupedTournaments.rapid.push(tournament);
        break;
      case 'blitz':
        groupedTournaments.blitz.push(tournament);
        break;
    }
  });

  const responseArray = Object.values(groupedTournaments);

  return res.json(responseArray);
});

app.get("/transfer/:username", async (req, res) => {

  const { username } = req.params;

  const date = new Date();

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  let response = await fetch(`https://api.chess.com/pub/player/${username}/games/${year}/${month}`)
  let data = await response.json();

  // console.log(data)

  let games = data.games;

  if (data.code == 0 || games.length == 0) {
    return res.json({
      error: `No games found for ${username} for the month of ${month}/${year}`
    })
  }

  let lastGame = games[games.length - 1];

  let pgn = lastGame.pgn;

  let formData = new URLSearchParams();
  formData.append('pgn', pgn);

  let response_lichess = await fetch(`https://lichess.org/api/import`, {
    method: 'POST',
    body: formData,
  });

  let data_lichess = await response_lichess;

  let url = data_lichess.url;

  console.log(url);

  return res.json({
    lichess_url: url,
    ...lastGame,
  })
});




app.get("/init", async (req, res) => {
  const members = JSON.parse(`{
  "members": [
    {
      "name": "Abolmaali Kayvan",
      "origin": "IRN",
      "FIDE_ID": "668761",
      "birth_date": ""
    },
    {
      "name": "Benlahrache Mohamed",
      "totem": "owl",
      "origin": "DZA",
      "FIDE_ID": "652006522",
      "birth_date": ""
    },
    {
      "name": "Bouchez Guillaume",
      "totem": "robot",
      "origin": "FRA",
      "FIDE_ID": "551003970",
      "birth_date": ""
    },
    {
      "name": "Boukeffa Nassim",
      "origin": "DZA",
      "FIDE_ID": "652038653",
      "birth_date": ""
    },
    {
      "name": "Bouychou Armand",
      "totem": "ogre",
      "origin": "FRA",
      "FIDE_ID": "551004020",
      "birth_date": ""
    },
    {
      "name": "Calas-Aguilar Luken",
      "totem": "horse",
      "origin": "FRA",
      "FIDE_ID": "652013952",
      "birth_date": ""
    },
    {
      "name": "Chernikova Iryna",
      "totem": "spider",
      "origin": "UKR",
      "FIDE_ID": "36085243",
      "birth_date": ""
    },
    {
      "name": "Coelho Laurent",
      "totem": "skunk",
      "origin": "FRA",
      "FIDE_ID": "45104840",
      "birth_date": ""
    },
    {
      "name": "Dabrowski Rémi",
      "totem": "bull",
      "origin": "POL",
      "FIDE_ID": "651097982",
      "birth_date": "2002-06-24"
    },
    {
      "name": "Fabre David",
      "totem": "boar",
      "origin": "FRA",
      "FIDE_ID": "651079712",
      "birth_date": ""
    },
    {
      "name": "Fanon Frédéric",
      "origin": "FRA",
      "FIDE_ID": "551060817",
      "birth_date": ""
    },
    {
      "name": "Fargues Stéphanie",
      "origin": "FRA",
      "FIDE_ID": "26036657",
      "birth_date": ""
    },
    {
      "name": "Kennedy John",
      "origin": "GBR",
      "FIDE_ID": "45117721",
      "birth_date": ""
    },
    {
      "name": "Krause Max",
      "totem": "wolf",
      "origin": "GER",
      "FIDE_ID": "4663640",
      "birth_date": ""
    },
    {
      "name": "Lestrohan Pierre",
      "totem": "lobster",
      "origin": "RUS",
      "FIDE_ID": "34177563",
      "birth_date": ""
    },
    {
      "name": "Macqueron Grégory",
      "totem": "panda",
      "origin": "POL",
      "FIDE_ID": "551004240",
      "birth_date": "1976-01-15"
    },
    {
      "name": "Malinowski Christophe",
      "totem": "lynx",
      "origin": "POL",
      "FIDE_ID": "652014010",
      "birth_date": ""
    },
    {
      "name": "Morata Jules",
      "totem": "devil",
      "origin": "FRA",
      "FIDE_ID": "26094851",
      "birth_date": "2000-03-20"
    },
    {
      "name": "Moreux Vincent",
      "origin": "FRA",
      "FIDE_ID": "652014525",
      "birth_date": ""
    },
    {
      "name": "Morin Min",
      "origin": "CHN",
      "FIDE_ID": "651021781",
      "birth_date": ""
    },
    {
      "name": "Perroux Jacques",
      "origin": "FRA",
      "FIDE_ID": "26004402",
      "birth_date": ""
    },
    {
      "name": "Petrowitsch Ruediger",
      "totem": "raptor",
      "origin": "GER",
      "FIDE_ID": "36003174",
      "birth_date": ""
    },
    {
      "name": "Pochet Frédéric",
      "totem": "dog",
      "origin": "FRA",
      "FIDE_ID": "651051150",
      "birth_date": ""
    },
    {
      "name": "Rich Philippe",
      "totem": "bear",
      "origin": "FRA",
      "FIDE_ID": "661643",
      "birth_date": ""
    },
    {
      "name": "Reverdy Micah",
      "totem": "cow",
      "origin": "ESP",
      "FIDE_ID": "24558869",
      "birth_date": ""
    },
    {
      "name": "Sarath",
      "totem": "angel",
      "origin": "IND",
      "FIDE_ID": "25008846",
      "birth_date": ""
    },
    {
      "name": "Schoettler Mike",
      "totem": "fox",
      "origin": "GER",
      "FIDE_ID": "45141274",
      "birth_date": ""
    },
    {
      "name": "Sena Ferreira Raul",
      "totem": "chicken",
      "origin": "BRA",
      "FIDE_ID": "651087162",
      "birth_date": ""
    },
    {
      "name": "Toscani Jean-Patrick",
      "totem": "snail",
      "origin": "FRA",
      "FIDE_ID": "26004518",
      "birth_date": ""
    },
    {
      "name": "Tsihlas Alexandre",
      "origin": "GRC",
      "FIDE_ID": "26060728",
      "birth_date": ""
    },
    {
      "name": "Viaud Thierry",
      "totem": "crocodile",
      "origin": "FRA",
      "FIDE_ID": "20609973",
      "birth_date": ""
    },
    {
      "name": "Levacic Melissa",
      "origin": "POL",
      "FIDE_ID": "633747",
      "birth_date": ""
    },
    {
      "name": "Castellet-Menchon Didac",
      "origin": "ESP",
      "FIDE_ID": "22220410",
      "birth_date": ""
    },
    {
      "name": "Di Cerbo Ciro",
      "origin": "FRA",
      "FIDE_ID": "26084511",
      "birth_date": ""
    },
    {
      "name": "Wiggenhauser Amy",
      "origin": "FRA",
      "FIDE_ID": "653020570",
      "birth_date": ""
    },
    {
      "name": "Toulouze Pierre",
      "origin": "FRA",
      "FIDE_ID": "653006453",
      "birth_date": ""
    },
    {
      "name": "Tachot Christophe",
      "origin": "FRA",
      "FIDE_ID": "652064972",
      "birth_date": ""
    },
    {
      "name": "Soler Cédric",
      "origin": "FRA",
      "FIDE_ID": "653027760",
      "birth_date": ""
    },
    {
      "name": "Madiès Léo",
      "origin": "FRA",
      "FIDE_ID": "653027701",
      "birth_date": ""
    },
    {
      "name": "Mouillé André",
      "origin": "FRA",
      "FIDE_ID": "653086562",
      "birth_date": ""
    },
    {
      "name": "Stangl Anita",
      "origin": "DE",
      "FIDE_ID": "4608801",
      "birth_date": ""
    },
    {
      "name": "Kraba Hamou",
      "origin": "FRA",
      "FIDE_ID": "653094697",
      "birth_date": ""
    },
    
    {
      "name": "Gambardella Eddie",
      "origin": "FRA",
      "FIDE_ID": "653017498",
      "birth_date": ""
    },
    {
      "name": "Damasceno Taina",
      "origin": "FRA",
      "FIDE_ID": "652031802",
      "birth_date": ""
    },
    {
      "name": "Luminais Eric",
      "origin": "FRA",
      "FIDE_ID": "610372",
      "birth_date": ""
    },
    {
    "name": "Mohtaji Javad",
      "origin": "FRA",
      "FIDE_ID": "617229",
      "birth_date": ""
    },
    {
      "name": "Viné Thibaut",
      "origin": "FRA",
      "FIDE_ID": "20654227",
      "birth_date": ""
    },
    {
      "name": "Erhart François-Xavier",
      "origin": "FRA",
      "FIDE_ID": "20663099",
      "birth_date": ""
    },
    {
      "name": "Santos Marvin",
      "origin": "FRA",
      "FIDE_ID": "80453155",
      "birth_date": ""
    }
    
    
  ]
}`)
  console.log(members.members);
  for (let i = 0; i < members.members.length; i++) {
    const member = members.members[i];
    const fideId = member.FIDE_ID;

    // if member arelady in db, skip
    const existingPlayer = await prisma.player.findFirst({
      where: {
        fideId: parseInt(fideId),
      },
    });

    if (existingPlayer) {
      continue;
    }

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
      // if (error.code === "P2002" && error.meta.target.includes("fideId")) {
      //   res
      //     .status(409)
      //     .json({ error: "A player with this FIDE ID already exists" });
      // } else {
      //   console.log(error);
      //   res
      //     .status(500)
      //     .json({ error: "An error occurred while creating the player" });
      // }
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

  }
});

app.listen(process.env.PORT, () => console.log("Server is running on port 3000"));

// const http = require('http');

// setInterval(() => {
//   http.get("http://cate-rankings-backend.herokuapp.com/");
// }, 25 * 60 * 1000); // every 25 minutes

module.exports = app;

