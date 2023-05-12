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

module.exports = { scrapePlayerInfo };
