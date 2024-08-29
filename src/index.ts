import express from "express";
import { config } from "dotenv";
import { z } from "zod";
import { PatchSchema, UploadSchema } from "./validationSchemas";
import prisma from "./db";
import { MeasureType } from "@prisma/client";

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

// TODO
app.post("/upload", async (req, res) => {
  try {
    await UploadSchema.parseAsync(req.body);
  } catch (err) {
    console.error(err);
  }
});

// Patch route for confirming and updating a stored measure.
app.patch("/confirm", async (req, res) => {
  try {
    // Parse the request body with the validation schema.
    const validatedData = await PatchSchema.parseAsync(req.body);

    // Get the measure from the database.
    const measure = await prisma.measure.findUnique({
      where: { measure_uuid: validatedData.measure_uuid },
    });

    // Handle the case where no measure was found.
    if (!measure) {
      return res.status(404).json({
        error_code: "MEASURE_NOT_FOUND",
        error_description: "The specified measure was not found.",
      });
    }

    // Handle the case of a already confirmated measure.
    if (measure.has_confirmed) {
      return res.status(409).json({
        error_code: "validatedData_DUPLICATE",
        error_description: "The specified measure was already confirmed.",
      });
    }

    // Update the measure on the database.
    await prisma.measure.update({
      data: {
        has_confirmed: true,
        measure_value: validatedData.confirmed_value,
      },
      where: { measure_uuid: validatedData.measure_uuid },
    });

    // Return a sucess response.
    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    // Verify if an error is a input error.
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error_code: "INVALID_DATA",
        error_description: err.message,
      });
    }

    // Return a response for unhandled errors.
    console.error(`Unhandled Error:${err}`);
    return res.status(500).json({
      error_code: "INTERNAL_SERVER_ERROR",
      error_description: "An unexpected error occurred.",
    });
  }
});

// Get Route for getting the list of measures for a given user.
app.get("/:customerCode/list", async (req, res) => {
  try {
    // Get the customer code and measureType from the request.
    const customerCode = req.params.customerCode;
    let measureType = req.query.measure_type;

    // Verify the measure type
    if (measureType) {
      // Handle invalid measure types.
      if (typeof measureType !== "string") {
        return res.status(400).json({
          error_code: "INVALID_MEASURE_TYPE",
          error_description:
            "Couldn't get a valid measure type from the query.",
        });
      }

      // Parse the measure type to assure they are correct.
      measureType = await z
        .enum(["WATER", "GAS"], { message: "Invalid measure type." })
        .parseAsync(measureType.toUpperCase());
    }

    // Get the data from the database.
    const measures = await prisma.measure.findMany({
      where: {
        customerCode: customerCode,
        ...(measureType && { type: measureType as MeasureType }),
      },
      select: {
        measure_uuid: true,
        measure_datetime: true,
        image_url: true,
        has_confirmed: true,
        measure_type: true,
        measure_value: true,
      },
    });

    // If no measure is found, return a 404 response.
    if (measures.length === 0) {
      return res.status(404).json({
        error_code: "MISSING_MEASURES",
        error_description: "No measure was found.",
      });
    }

    // Return a sucess response.
    return res
      .status(200)
      .json({ customer_code: customerCode, measures: measures });
  } catch (err) {
    // Handle a ZodError in the case the enum was not parsed correctly.
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error_code: "INVALID_TYPE", error_description: err.message });
    }

    // Return a response for unhandled errors.
    console.error(`Unhandled Error:${err}`);
    return res.status(500).json({
      error_code: "INTERNAL_SERVER_ERROR",
      error_description: "An unexpected error occurred.",
    });
  }
});

// Get the port and start the HTTP server.
const port = process.env.PORT || 3000;
app.listen(port);
console.log(`Started listening at port: ${port}`);
