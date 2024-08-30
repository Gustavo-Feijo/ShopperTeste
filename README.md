# Code Test

---

This project is a coding test developed for a Junior Developer position for Shopper.

It's a REST API made with Node.js and Typescript, using Docker for containerization and Express.js as the Framework.

Receives images of measures of Gas and Water, pass the images to a LLM Model to get the reading, then store it into the database.

---

## Functionalities

The project has 3 main endpoints.

- /upload: **(POST)** Receives a base64 image, measure date, type and customer code. Validate the data types, including the base64 image, requiring a mime type (ex: data:image/png) due to API requirements. Validate all cases of duplication and then stores the value received from the LLM into the database.
- /confirm: **(Patch)** Confirm the value previously stored and save the confirmed in the database.
- /:customerCode/list: **(GET)** Get the list of measures for a given customerCode. Can receive queries referred to the measure type. (ex: /abc/list?measure_type=GAS).
  
---

## Technologies

The currently employed technologies are as follow:
- Express.js
- Docker and Docker-Compose
- Prisma
- Postgresql
- Zod
  
---

## Running

The steps for running the project are:

1. Install Docker and Docker Compose.
2. Create a .env file containing the Gemini Api Key. **Ex:GEMINI_API_KEY=API KEY**
3. Run **docker compose up --build**