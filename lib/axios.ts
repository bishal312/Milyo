import axios from "axios";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_URL || "/api",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});