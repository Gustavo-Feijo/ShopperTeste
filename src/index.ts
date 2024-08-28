import express from "express";
import { config } from "dotenv";

// Load the .env file and look for errors.
const keyLoad = config();
if (keyLoad.error) {
  throw new Error(`Coulnd't load the .env file: ${keyLoad.error.message}`);
}
console.log("Dotenv file loaded correctly.");

// Get the API Key and assure it's present.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Gemini API Key Missing.");
}

console.log("Gemini API Key found.");
// Instanciate the express application.
const app = express();

// Parse the requests to json.
app.use(express.json());

app.post("/upload", (req, res) => {
  console.log(req.body);
});
// Get the port and start the HTTP server.
const port = process.env.PORT || 3000;
app.listen(port);
console.log(`Started listening at port: ${port}`);
