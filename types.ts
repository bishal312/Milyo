import * as z from "zod";
export const reportSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    category: z.enum([
        "ELECTRONICS",
        "CLOTHING",
        "DOCUMENTS",
        "KEYS",
        "BAGS",
        "BOOKCOPY",
        "OTHER",
    ]),
    type: z.enum(["LOST", "FOUND"]),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
});

export type ReportFormValues = z.infer<typeof reportSchema>;