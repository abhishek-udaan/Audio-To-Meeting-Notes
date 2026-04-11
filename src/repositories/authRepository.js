import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { authDir } from "../config/paths.js";

const usersFile = path.join(authDir, "users.json");
const sessionsFile = path.join(authDir, "sessions.json");

async function readJson(filePath, fallback) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function upsertUser(profile) {
  const users = await readJson(usersFile, []);
  const now = new Date().toISOString();
  const existingIndex = users.findIndex((user) => user.id === profile.id);
  const nextUser = {
    ...profile,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...nextUser
    };
  } else {
    users.push({
      ...nextUser,
      createdAt: now
    });
  }

  await writeJson(usersFile, users);
  return users.find((user) => user.id === profile.id);
}

export async function findUserById(userId) {
  const users = await readJson(usersFile, []);
  return users.find((user) => user.id === userId) || null;
}

export async function createSession(userId) {
  const sessions = await readJson(sessionsFile, []);
  const session = {
    id: randomUUID(),
    userId,
    createdAt: new Date().toISOString()
  };

  sessions.push(session);
  await writeJson(sessionsFile, sessions);
  return session;
}

export async function findSessionById(sessionId) {
  const sessions = await readJson(sessionsFile, []);
  return sessions.find((session) => session.id === sessionId) || null;
}

export async function deleteSession(sessionId) {
  const sessions = await readJson(sessionsFile, []);
  const remainingSessions = sessions.filter((session) => session.id !== sessionId);
  await writeJson(sessionsFile, remainingSessions);
}
