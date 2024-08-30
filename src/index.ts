import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { PatchSchema, UploadSchema } from "./validationSchemas";
import { MeasureType } from "@prisma/client";
import { config } from "dotenv";
import express from "express";
import fs from "fs/promises";
import prisma from "./db";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import mime from "mime-types";

// Load the .env file and look for errors.
const keyLoad = config();
if (keyLoad.error) {
  throw new Error(`Coulnd't load the .env file: ${keyLoad.error.message}`);
}
console.log("Dotenv file loaded correctly.");

// Verify if the API KEY is present.
if (!process.env.GEMINI_API_KEY) {
  throw new Error("Gemini API Key Missing.");
}
// Instanciate the GenAI.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
if (!genAI) {
  throw new Error("Couldn't instanciate the Google Generative AI.");
}

console.log("Gemini API Key found.");

// Get the model to be used.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});
if (!model) {
  throw new Error("Couldn't get the generative model.");
}

// Instanciate the express application.
const app = express();

// Parse the requests to json.
app.use(express.json({ limit: "20mb" }));

// Send the images.
app.use("/images", express.static("temp/"));

// Post route for handling image uploading to extract measures.
app.post("/upload", async (req, res) => {
  try {
    // Validate the data with the Zod Schema.
    const validatedData = await UploadSchema.parseAsync(req.body);
    // Get the data from the passed datetime.
    const measureDate = new Date(validatedData.measure_datetime);

    // Get any measure for the same month and type.
    const duplicate = await prisma.measure.findFirst({
      where: {
        measure_type: validatedData.measure_type,
        measure_datetime: {
          // Get any date greater thar or equal as the first day of the passed month.
          // And less than the first day of the next month.
          gte: new Date(measureDate.getFullYear(), measureDate.getMonth(), 1),
          lt: new Date(
            measureDate.getFullYear(),
            measureDate.getMonth() + 1,
            1
          ),
        },
      },
    });

    // Handle a duplicate.
    if (duplicate) {
      return res.status(409).json({
        error_code: "DOUBLE_REPORT",
        error_description:
          "A measure of same type was already done for this month.",
      });
    }
    // Get the metadata.
    const metadata = validatedData.image.split(";", 1)[0];

    // Handle missing metadata.
    if (!metadata) {
      return res.status(400).json({
        error_code: "INVALID_DATA",
        error_description: "The BASE64 image is missing it's metadata.",
      });
    }

    // Get the mime type.
    const mimeType = metadata.split(":")[1];

    // List of the accepted mime types by the Gemini Vision API.
    const validImageTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    // Handle mime types not supported.
    if (!validImageTypes.includes(mimeType)) {
      return res.status(400).json({
        error_code: "INVALID_DATA",
        error_description:
          "A image with a splicit and valid metadata should be provided.",
      });
    }

    // Get the raw base64 data.
    const base64data = validatedData.image.split(",")[1];

    // Create the data from the image.
    const image: Part = {
      inlineData: {
        data: base64data,
        mimeType: mimeType,
      },
    };

    // Prompt describing what to get from the image.
    const prompt =
      "This image is a measurement of a gas or water reading. Return the raw value of the measure as a number, without any adicional description.";

    //Call for getting the data from the model and parsing to int.
    const getContent = await model.generateContent([prompt, image]);
    const parsedResponseValue = Number.parseInt(getContent.response.text());

    // Handle a case where no integer value was returned.
    if (isNaN(parsedResponseValue)) {
      return res.status(400).json({
        error_code: "INVALID_DATA",
        error_description: "Couldn't retrieve a integer result from the image.",
      });
    }

    // Verify if the returned value is within the postgres int range.
    const MIN_INT32 = -2147483648;
    const MAX_INT32 = 2147483647;

    if (!(parsedResponseValue > MIN_INT32 && parsedResponseValue < MAX_INT32)) {
      return res.status(400).json({
        error_code: "INVALID_DATA",
        error_description: "The returned measure value is too big.",
      });
    }
    // Get the file extension from the mime type.
    const fileExtension = mimeType.split("/")[1];

    // Create the path to where we will create the file.
    const filePath = `${uuidv4()}.${fileExtension}`;
    await fs.writeFile(`temp/${filePath}`, Buffer.from(base64data, "base64"));

    // Create the entry on the database based on the model response.
    const result = await prisma.measure.create({
      data: {
        customerCode: validatedData.customer_code,
        measure_datetime: validatedData.measure_datetime,
        measure_type: validatedData.measure_type,
        image_url: filePath,
        measure_value: parsedResponseValue,
      },
      select: { image_url: true, measure_value: true, measure_uuid: true },
    });

    console.log("Succesfully inserted a new measure in the database.");
    // Return a sucess response.
    return res
      .status(200)
      .json({ ...result, image_url: `/images/${result.image_url}` });
  } catch (err) {
    // Handle a ZodError.
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error_code: "INVALID_DATA", error_description: err.message });
    }
    // Return a response for unhandled errors.
    console.error(`Unhandled Error:${err}`);
    return res.status(500).json({
      error_code: "INTERNAL_SERVER_ERROR",
      error_description: "An unexpected error occurred.",
    });
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
app.listen(port, () => console.log(`Started listening at port: ${port}`));
