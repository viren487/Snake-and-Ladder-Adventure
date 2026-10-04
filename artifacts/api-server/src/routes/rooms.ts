import { Router, type Request, type Response } from "express";
import { CreateGameRoomBody, JoinGameRoomBody, ActInGameRoomBody } from "@workspace/api-zod";
import { createRoom, joinRoom, readRoom, actInRoom, prepareAdmission, RoomError } from "../lib/game-rooms";
import { logger } from "../lib/logger";

const router = Router();
const rateWindows = new Map<string, { until: number; requests: number }>();
router.use((req, res, next) => {
  const publicWrite = req.method === "POST" && !req.path.endsWith("/actions");
  const key = `${req.ip}:${publicWrite ? "admit" : "play"}`;
  const now = Date.now();
  if (rateWindows.size > 10000) for (const [ip, entry] of rateWindows) if (entry.until < now) rateWindows.delete(ip);
  let entry = rateWindows.get(key);
  if (!entry || entry.until < now) { entry = { until: now + 60_000, requests: 0 }; rateWindows.set(key, entry); }
  if (++entry.requests > (publicWrite ? 30 : 600)) {
    res.status(429).json({ error: "Too many requests. Please wait a minute." }); return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
function codeOf(req: Request) {
  const code = String(req.params.code).trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new RoomError(400, "Enter a six-character room code.");
  return code;
}
function tokenOf(req: Request) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "");
  if (!match) throw new RoomError(401, "A valid room seat is required.");
  return match[1];
}
function route(work: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try { await work(req, res); }
    catch (error) {
      if (error instanceof RoomError) res.status(error.status).json({ error: error.message });
      else { logger.error({ err: error }, "Multiplayer request failed"); res.status(500).json({ error: "The online server could not complete this request. Your round has not been reset." }); }
    }
  };
}
router.post("/admission-ticket", route(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(prepareAdmission());
}));
router.post("/", route(async (req, res) => {
  const body = CreateGameRoomBody.safeParse(req.body);
  if (!body.success) throw new RoomError(400, "Use a name up to 24 characters and choose 2, 3 or 4 players.");
  res.status(201).json(await createRoom(body.data.name, body.data.maxPlayers, body.data.admissionToken));
}));
router.post("/:code/join", route(async (req, res) => {
  const body = JoinGameRoomBody.safeParse(req.body);
  if (!body.success) throw new RoomError(400, "Player name must be at most 24 characters.");
  res.json(await joinRoom(codeOf(req), body.data.name, body.data.admissionToken));
}));
router.get("/:code", route(async (req, res) => { res.json(await readRoom(codeOf(req), tokenOf(req))); }));
router.post("/:code/actions", route(async (req, res) => {
  const body = ActInGameRoomBody.safeParse(req.body);
  if (!body.success) throw new RoomError(400, "Invalid action. Refresh the room and try again.");
  res.json(await actInRoom(codeOf(req), tokenOf(req), body.data));
}));
export default router;