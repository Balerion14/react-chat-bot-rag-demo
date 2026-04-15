import { Hono } from "hono";
import { db } from "../db";
import { chatRunsTable, reservationsTable } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { handleUserInput } from "../lib/ai/rag";
import { cors } from "hono/cors";

// Initialize the Hono application
const app = new Hono();
app.use(
  "*",
  cors({
    origin: "http://localhost:8081",
  })
);


/**
 * Health check route used to confirm that the API server is reachable.
 */
app.get("/health", (c) => {
  return c.json({ message: "Hello from server" }, 200);
});

/**
 * Receives a new user message, verifies the reservation exists and message as well, then runs the RAG workflow.
 */
app.post("/rag/newMessage", async (c) => {
  const body = await c.req.json();
  const message = body.message ?? "";
  const reservationId = body.reservationId ?? "";

  if (!message || !reservationId) {
    return c.json({ error: "Missing message or reservationId" }, 400);
  }

  try {
    //verif reservationId exists in db
    const reservation = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.id, reservationId))
      .limit(1)
      .then((results) => results[0]);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }
  } catch (error) {
    return c.json({ error: "Reservation not found" }, 404);
  }

  try {
    //handle user input with RAG
    await handleUserInput(reservationId, ["Refund request"], message);
    return c.json({
      reply: "User input processed successfully",
      reservationId,
    }, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({ errorGeneral: "Error processing user input", error: errorMessage }, 500);
  }
});

/**
 * Returns the list of reservation ids and guest names currently stored in the database for each reservation id.
 */
app.get("/reservations/info", async (c) => {
  try {
    const reservations = await db
      .select({ id: reservationsTable.id, guestName: reservationsTable.guestName })
      .from(reservationsTable)
      .orderBy(reservationsTable.createdAt);
    return c.json({
      reservationInfo: reservations.map((reservation) => { return { id: reservation.id, guestName: reservation.guestName } }),
    }, 200);
  } catch (error) {
    return c.json({ error: "Error retrieving reservation info" }, 500);
  }
});

/**
 * Retrieves the conversation history for a given reservation id
 */
app.get("/reservations/:id/conversation", async (c) => {
  const reservationId = c.req.param("id");

  if (!reservationId) {
    return c.json({ error: "Missing reservationId" }, 400);
  }

  try {
    //verif reservationId exists in db
    const reservation = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.id, reservationId))
      .limit(1)
      .then((results) => results[0]);
    if (!reservation) {
      return c.json({ error: "Reservation not found" }, 404);
    }
  } catch (error) {
    return c.json({ error: "Reservation not found" }, 404);
  }

  //retrieve conversation history for the reservation id
  try {
    const conversationHistory = await db
      .select()
      .from(chatRunsTable)
      .where(eq(chatRunsTable.reservationId, reservationId))
      .orderBy(desc(chatRunsTable.createdAt));
    return c.json({
      reservationId,
      conversationHistory,
    }, 200);
  } catch (error) {
    return c.json({ error: "Error retrieving conversation history" }, 500);
  }
});

// configure the server to listen on the specified port and export the app for testing purposes and say to bun to use the app and with this port
export default {
  port: 3001,
  fetch: app.fetch,
};
