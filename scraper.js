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
    res.firstName = nameParts[1].trim();
    res.lastName = nameParts[0].trim();

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

const puppeteer = require('puppeteer');

async function scrapeFideData(id, period, rating) {
    const url = `https://ratings.fide.com/calculations.phtml?id_number=${id}&period=${period}&rating=${rating}`;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    const tournament = await page.evaluate(() => {

      const tournamentRows = Array.from(document.querySelectorAll('.calc_table tr[bgcolor="#efefef"]'));
      const tournaments = [];
      
      for (let i = 0; i < tournamentRows.length; i++) {
          let row = tournamentRows[i];
          if (row.querySelector('td b a')) { // new tournament
              let tournamentName = row.querySelector('td b a').innerText.trim();
              tournaments.push({ name: tournamentName, games: [] });
          } else { // game in current tournament
              let cells = row.querySelectorAll('td');
              let opponentName = cells[0].innerText.trim();
              let opponentElo = cells[3].innerText.trim();
              let result = cells[5].innerText.trim();
              let kChange = cells[9].innerText.trim();
              let game = { opponentName, opponentElo, result, kChange };
              tournaments[tournaments.length - 1].games.push(game);
          }
      }
      return tournaments;
      
    });

    await browser.close();

    return tournament;
}



module.exports = { scrapePlayerInfo, getPlayerEloList, scrapeFideData };
