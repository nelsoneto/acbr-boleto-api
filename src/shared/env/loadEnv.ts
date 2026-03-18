import dotenv from "dotenv";

export function loadEnv() {
  dotenv.config({
    path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev",
  });
}
