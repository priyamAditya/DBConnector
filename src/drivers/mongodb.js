import { MongoClient } from "mongodb";

const clients = new Map();

function buildUri(conn) {
  const proto = conn.ssl ? "mongodb+srv" : "mongodb";
  const userPass = conn.username && conn.password
    ? `${encodeURIComponent(conn.username)}:${encodeURIComponent(conn.password)}@`
    : "";
  // mongodb+srv doesn't use a port
  const hostPort = conn.ssl ? conn.host : `${conn.host}:${conn.port}`;
  return `${proto}://${userPass}${hostPort}/${conn.database}?authSource=admin`;
}

export async function testConnection(conn) {
  const client = new MongoClient(buildUri(conn), {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const admin = client.db().admin();
    const info = await admin.serverInfo();
    return { success: true, version: `MongoDB ${info.version}` };
  } finally {
    await client.close();
  }
}

function getClient(conn) {
  if (!clients.has(conn.name)) {
    const client = new MongoClient(buildUri(conn), {
      connectTimeoutMS: 10000,
      maxPoolSize: 5,
    });
    clients.set(conn.name, { client, dbName: conn.database });
  }
  return clients.get(conn.name);
}

export async function runQuery(conn, sql) {
  const { client, dbName } = getClient(conn);
  await client.connect();
  const db = client.db(dbName);

  // Parse the query string — expects JSON like:
  // { "collection": "users", "action": "find", "filter": { "age": { "$gt": 21 } } }
  // Supported actions: find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, aggregate, countDocuments
  let cmd;
  try {
    cmd = JSON.parse(sql);
  } catch {
    throw new Error(
      'MongoDB queries must be JSON. Example: {"collection":"users","action":"find","filter":{"age":{"$gt":21}}}\n' +
      'Supported actions: find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, aggregate, countDocuments'
    );
  }

  const collection = db.collection(cmd.collection);
  if (!cmd.collection || !cmd.action) {
    throw new Error('JSON must include "collection" and "action" fields.');
  }

  switch (cmd.action) {
    case "find": {
      const cursor = collection.find(cmd.filter ?? {});
      if (cmd.sort) cursor.sort(cmd.sort);
      if (cmd.limit) cursor.limit(cmd.limit);
      if (cmd.skip) cursor.skip(cmd.skip);
      if (cmd.project) cursor.project(cmd.project);
      const rows = await cursor.toArray();
      return {
        command: "find",
        rowCount: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      };
    }
    case "aggregate": {
      const rows = await collection.aggregate(cmd.pipeline ?? []).toArray();
      return {
        command: "aggregate",
        rowCount: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      };
    }
    case "countDocuments": {
      const count = await collection.countDocuments(cmd.filter ?? {});
      return { command: "countDocuments", rowCount: count, columns: ["count"], rows: [{ count }] };
    }
    case "insertOne": {
      const res = await collection.insertOne(cmd.document);
      return { command: "insertOne", rowCount: 1, columns: ["insertedId"], rows: [{ insertedId: res.insertedId }] };
    }
    case "insertMany": {
      const res = await collection.insertMany(cmd.documents);
      return { command: "insertMany", rowCount: res.insertedCount, columns: ["insertedCount"], rows: [{ insertedCount: res.insertedCount }] };
    }
    case "updateOne": {
      const res = await collection.updateOne(cmd.filter ?? {}, cmd.update);
      return { command: "updateOne", rowCount: res.modifiedCount, columns: ["matchedCount", "modifiedCount"], rows: [{ matchedCount: res.matchedCount, modifiedCount: res.modifiedCount }] };
    }
    case "updateMany": {
      const res = await collection.updateMany(cmd.filter ?? {}, cmd.update);
      return { command: "updateMany", rowCount: res.modifiedCount, columns: ["matchedCount", "modifiedCount"], rows: [{ matchedCount: res.matchedCount, modifiedCount: res.modifiedCount }] };
    }
    case "deleteOne": {
      const res = await collection.deleteOne(cmd.filter ?? {});
      return { command: "deleteOne", rowCount: res.deletedCount, columns: ["deletedCount"], rows: [{ deletedCount: res.deletedCount }] };
    }
    case "deleteMany": {
      const res = await collection.deleteMany(cmd.filter ?? {});
      return { command: "deleteMany", rowCount: res.deletedCount, columns: ["deletedCount"], rows: [{ deletedCount: res.deletedCount }] };
    }
    default:
      throw new Error(`Unknown action "${cmd.action}". Supported: find, aggregate, countDocuments, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany`);
  }
}

export async function closePool(name) {
  const entry = clients.get(name);
  if (entry) {
    await entry.client.close();
    clients.delete(name);
  }
}

export const defaultPort = 27017;
export const label = "MongoDB";
