# cate-rankings-backend

This is the backend of the website that I created for my chess club (CATE - Cercle Airbus Toulouse Échecs).
It is hosted on Heroku and the database is at neon.tech.

In a nutshell, the backend scrapes the official chess federation website (e.g. my profile https://ratings.fide.com/profile/651097982) once a month (at each elo change) and updates the database with the new values.
In my database are 3 tables:
Players, Elos and Games.


Here is the frontend repo: https://github.com/Learza7/cate-rankings-frontend

Stack:
- API: Node.js and Express.js
- Scraping: cheerio and puppeteer
- Database: Prisma and PostgreSQL.
