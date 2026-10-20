// Run one SQL statement against DATABASE_URL and print rows: node --env-file=.env scripts/sql.mjs "select 1"
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
console.log(JSON.stringify(await sql.query(process.argv[2]), null, 1));
