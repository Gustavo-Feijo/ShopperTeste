import { Base64 } from "js-base64";
import { z } from "zod";

/**
 * Validation schema for the Upload request body.
 */
export const UploadSchema = z.object({
  image: z.string().refine(
    (value) => {
      // Split the base64 string to separete the mime type and only validate the data.
      const [_, base64Data] = value.split(",");

      // Ensure base64 data is present and valid
      if (!base64Data || !Base64.isValid(base64Data)) {
        return false;
      }
      return value;
    },
    {
      message: "A valid Base64 image must be provided.",
    }
  ),
  customer_code: z.string({ message: "The customer code must be a string." }),
  measure_datetime: z.string().datetime({ message: "Invalid datetime." }),
  measure_type: z.enum(["WATER", "GAS"], {
    message: "Invalid measure type.",
  }),
});

/**
 * Validation schema for the Patch request body.
 */
export const PatchSchema = z.object({
  measure_uuid: z
    .string({ message: "The measure UUID value is not a string." })
    .uuid({ message: "The measure UUID is invalid." }),
  confirmed_value: z
    .number()
    .int({ message: "The confirmed value must be a integer." }),
});
