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
module.exports = { scrapePlayerInfo, getPlayerEloList };
