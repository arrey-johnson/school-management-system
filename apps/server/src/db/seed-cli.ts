import { loadEnv } from "../config/env.js";
import { openDatabase } from "./client.js";
import { seedFoundation } from "./seed.js";

const env = loadEnv();
const bundle = openDatabase(env.SMS_DATA_DIR);
seedFoundation(bundle.db);
bundle.sqlite.close();
console.log("Foundation seed complete.");
