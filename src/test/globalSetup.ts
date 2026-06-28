// src/test/globalSetup.ts
import { config } from "dotenv";
import { resolve } from "path";

export default function () {
  config({ path: resolve(process.cwd(), ".env.test"), override: true });
}
