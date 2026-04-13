import { ZodSchema } from "zod";

export class ContractValidator {

  static validate<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);

    if (!result.success) {
      console.error(result.error);
      throw new Error("API contract validation failed");
    }

    return result.data;
  }

}
