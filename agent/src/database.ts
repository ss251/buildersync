// TODO: Move all setup into the adapters themselves and dynamically import the adapter based on the current project.json
// This can be templated so that the agent can be cloned into a new repo and the correct adapter can be loaded at runtime / dynamically
// The goal is that the CLI can add or replace the adapter with a single line
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite"

import {
	elizaLogger
} from "@elizaos/runtime"

// import { intifacePlugin } from "@elizaos/plugin-intiface";
import Database from "better-sqlite3"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url) // get the resolved path to the file
const __dirname = path.dirname(__filename) // get the name of the directory

export function initializeDatabase(dataDir: string) {
		const filePath = process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite")
		elizaLogger.info(`Initializing SQLite database at ${filePath}...`)
		const db = new SqliteDatabaseAdapter(new Database(filePath))

		// Test the connection
		db.init()
			.then(() => {
				elizaLogger.success("Successfully connected to SQLite database")
			})
			.catch((error) => {
				elizaLogger.error("Failed to connect to SQLite:", error)
			})

		return db
}