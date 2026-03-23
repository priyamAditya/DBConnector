import * as postgres from "./postgres.js";
import * as mysql from "./mysql.js";
import * as clickhouse from "./clickhouse.js";
import * as mongodb from "./mongodb.js";
import * as redis from "./redis.js";

const drivers = {
  postgres,
  mysql,
  clickhouse,
  mongodb,
  redis,
};

export const DB_TYPES = Object.keys(drivers);

export const DB_LABELS = Object.fromEntries(
  Object.entries(drivers).map(([k, v]) => [k, v.label])
);

export const DEFAULT_PORTS = Object.fromEntries(
  Object.entries(drivers).map(([k, v]) => [k, v.defaultPort])
);

export function getDriver(dbtype) {
  const driver = drivers[dbtype];
  if (!driver) {
    throw new Error(`Unsupported database type "${dbtype}". Supported: ${DB_TYPES.join(", ")}`);
  }
  return driver;
}
