const axios = require("axios");
const cheerio = require("cheerio");

async function scrapePlayerInfo(fide_id) {
  const url = `https://ratings.fide.com/profile/${fide_id}`;

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    let res = {};

    // First Name and Last Name
    let fullName = $(".profile-top-title").first().text().trim();
    let nameParts = fullName.split(",");
    if (nameParts.length !== 2) {
      res.firstName = fullName.split(" ")[0].trim();
      res.lastName = fullName.split(" ")[2].trim();
    }
    else {
      res.firstName = nameParts[1].trim();
      res.lastName = nameParts[0].trim();
    }


    // Sex
    let sexElement = $(
      '.profile-top-info__block__row__header:contains("Sex:")'
    ).next();
    res.sex = sexElement.text().trim();

    // Federation
    let federationElement = $(
      '.profile-top-info__block__row__header:contains("Federation:")'
    ).next();
    res.federation = federationElement.text().trim();

    // Birth Year
    let birthYearElement = $(
      '.profile-top-info__block__row__header:contains("B-Year:")'
    ).next();
    res.birthYear = birthYearElement.text().trim();

    return res;
  } catch (error) {
    console.error(`Failed to scrape data from ${url}: `, error);
  }
}

async function getPlayerEloList(fide_id) {
  const url = `https://ratings.fide.com/profile/${fide_id}/chart`;

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    let res = [];

    $(".profile-table_chart-table tbody tr").each((index, element) => {
      let period = $(element).find("td").eq(0).text().trim();
      let classical = $(element).find("td").eq(1).text().trim();
      let rapid = $(element).find("td").eq(3).text().trim();
      let blitz = $(element).find("td").eq(5).text().trim();

      res.push({
        period,
        classical,
        rapid,
        blitz,
      });
    });
    return res;
  } catch (error) {
    console.error(`Failed to scrape data from ${url}: `, error);
  }
}

const puppeteer = require("puppeteer");

async function scrapeFideData(id, period) {
  const url = `https://ratings.fide.com/profile/${id}/calculations`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0" });

  const period_result = await page.evaluate(() => {
    const periodRow = Array.from(
      document.querySelectorAll(".profile-table_colors tr")
    )[2];

    const tds = Array.from(periodRow.querySelectorAll("td"));
    return tds.map((td) => {
      const anchor = td.querySelector("a");
      if (anchor && anchor.innerText != "Available") {
        return {
          text: anchor.innerText,
          href: anchor.href,
        };
      }
      return { text: td.innerText }; // If no anchor tag is found
    });
  });

  let tournaments_result = [[], [], []];
  // Loop through each returned object and navigate to the link if it exists
  for (let i = 1; i < period_result.length; i++) {
    if (period_result[i].href) {
      await page.goto(period_result[i].href, { waitUntil: "networkidle2" });
      const tournaments = await page.evaluate(() => {
        const tournamentRows = Array.from(
          document.querySelectorAll(".calc_table tr")
        );

        const tournaments = [];
        let currentTournament = null;

        tournamentRows.forEach((row) => {
          if (row.innerHTML.includes('<td colspan="4" width="400"><b>')) {
            if (currentTournament) {
              tournaments.push(currentTournament);
            }

            currentTournament = {
              title: row.innerText.trim().split("\t")[0],
              games: [],
            };
          } else if (currentTournament && row.innerText.trim()) {
            const gameData = row.innerText
              .trim()
              .split("\t")
              ;
            if (gameData.length > 7) {
              const colorImg = row.querySelector("img");
              const color = colorImg
                ? colorImg.src.includes("wh")
                  ? "w"
                  : "b"
                : null;

              currentTournament.games.push({
                opponentName: gameData[0],
                opponentElo: gameData[3],
                result: gameData[5],
                kChange: gameData[9],
                color: color,
              });
            }
          }
        });

        if (currentTournament) {
          tournaments.push(currentTournament);
        }

        return tournaments;
      });

      tournaments_result[i - 1] = tournaments;
    }
  }

  await browser.close();

  return {
    period: period_result[0].text,
    data: tournaments_result,
  }
}

async function getPlayerLastElo(fide_id) {
  const url = `https://ratings.fide.com/profile/${fide_id}/chart`;

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);


    const firstRow = $(".profile-table_chart-table tbody tr").first();
    const period = firstRow.find("td").eq(0).text().trim();
    const classical = firstRow.find("td").eq(1).text().trim();
    const rapid = firstRow.find("td").eq(3).text().trim();
    const blitz = firstRow.find("td").eq(5).text().trim();

    return {
      period,
      classical,
      rapid,
      blitz,
    };


  } catch (error) {
    console.error(`Failed to scrape data from ${url}: `, error);
  }
}


// scrapeFideData("651097982", "2022-11-01", "0");

module.exports = { scrapePlayerInfo, getPlayerEloList, scrapeFideData, getPlayerLastElo };
