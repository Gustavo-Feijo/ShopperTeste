import { z } from "zod";

/**
 * Validation schema for the Upload request body.
 */
export const UploadSchema = z.object({
  image: z
    .string()
    .regex(/^data:(image\/(?:jpeg|png));base64,/, "Invalid base 64 image."),
  customer_code: z.string({ message: "The customer code must be a string." }),
  measurement_datetime: z.string().datetime({ message: "Invalid datetime." }),
  measurement_type: z.enum(["WATER", "GAS"], {
    message: "Invalid measurement type.",
  }),
});

/**
 * Validation schema for the Patch request body.
 */
export const PatchSchema = z.object({
  measurement_uuid: z
    .string({ message: "The measurement UUID value is not a string." })
    .uuid({ message: "The measurement UUID is invalid." }),
  confirmed_value: z
    .number()
    .int({ message: "The confirmed value must be a integer." }),
});
