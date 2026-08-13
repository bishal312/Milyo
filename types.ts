import * as z from "zod";

const item_type = ["LOST", "FOUND"];

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
    type: z.enum(item_type),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
});

export type ReportFormValues = z.infer<typeof reportSchema>;

export const Item = z.object({
    id: z.string(),
    title: z.string().min(3, "At least 3 words are required for title"),
    description: z.string().optional().nullable(),
    type: z.enum(item_type),
    category: z.string(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
});

export type ItemType = z.infer<typeof Item>;