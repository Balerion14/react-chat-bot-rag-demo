import { z } from "zod/v3";

export const userInputSchema = z.object({
  userMessage: z.string().min(5).max(500),
  nameProperty: z.string().min(3).max(50),
  addressProperty: z.string().min(5).max(100),
  guestName: z.string().min(5).max(100),
  guestLanguage: z.string().min(2).max(20),
  checkInDate: z.date(),
  checkOutDate: z.date(),
  conversationHistory: z.array(z.object({
    user_message: z.string().min(0),
    detected_intent: z.string().min(3),
    filter: z.boolean(),
    need_to_retrieve_context: z.boolean(),
    retrieved_context: z.unknown().optional(),
    first_response: z.unknown().optional(),
    guardrail_status: z.string().min(3),
    final_reply: z.unknown().optional(),
  })),
});

export const intentSchema = z.object({
  intent: z.array(z.string()),
  confidentScore: z.number().min(0).max(1),
  reason: z.string().min(5).max(500)
});

export const filterSchema = z.object({
  isFiltered: z.boolean(),
  reason: z.string().min(5).max(500),
  confidentScore: z.number().min(0).max(1),
});

export const needRetrieveContextSchema = z.object({
  needToRetrieve: z.boolean(),
  reason: z.string().min(5).max(500),
  confidentScore: z.number().min(0).max(1),
});

export const firstResponseSchema = z.object({
  text: z.string(),
  confidentScore: z.number().min(0).max(1),
});

export const guardrailSchema = z.object({
  guardrailStatus: z.enum(["appropriate", "ask_clarification", "restart", "human_agent"]),
  reason: z.string().optional(),
  confidentScore: z.number().min(0).max(1).optional(),
  finalResponse: z.string().optional().describe("The final response to send to user if the guardrail status is appropriate, otherwise generate clarification question if status guardrail is ask_clarification or if status is human_agent, generate response to inform user that we will connect human agent to assist them, if status is restart, leave empty."),
})

export type UserInput = z.infer<typeof userInputSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type FilterResult = z.infer<typeof filterSchema>;
export type NeedRetrieveContextResult = z.infer<typeof needRetrieveContextSchema>;
export type FirstResponse = z.infer<typeof firstResponseSchema>;
export type GuardrailResult = z.infer<typeof guardrailSchema>;