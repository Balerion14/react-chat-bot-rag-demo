import { db } from "../../db";
import { chatRunsTable, knowledgeItemsTable, propertiesTable, reservationsTable } from "../../db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { type UserInput, userInputSchema, type Intent, intentSchema, filterSchema, type NeedRetrieveContextResult, needRetrieveContextSchema, type FirstResponse, firstResponseSchema, guardrailSchema } from "./type";
import { AI_GEMINI_CLIENT, AI_GEMINI_MODEL } from "./constant";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Helper function to extract error message from unknown error object.
 */
function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

/**
 * Validates the normalized user input payload before it is sent to the LLM pipeline.
 */
export async function getUserInputSchema(input: UserInput) {
    const validationResult = userInputSchema.safeParse(input);
    if (!validationResult.success) {
        throw new Error(`Invalid input: ${validationResult.error.message}`);
    }
    return validationResult.data;
}

/**
 * Classifies the user's intent against the list of intents available for the property.
 */
export async function classifyUserIntent(userInput: UserInput, intentList: string[]) {
    const prompt = `Classify the user's intent based on the following input user and context (history, user information, etc): ${JSON.stringify(userInput)}. The possible intents are: ${intentList.join(", ")}. Please provide the most likely intent or several intent if there are multiple intents that are equally likely.`;
    const response = await AI_GEMINI_CLIENT.models.generateContent({
        model: AI_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(intentSchema),
        },
    });
    const parsed = intentSchema.parse(JSON.parse(response.text ?? "{}"));
    return parsed;
}

/**
 * Decides whether the conversation must be routed to a human agent.
 */
export async function needHumanAgent(userInput: UserInput, classifiedIntent: Intent, businessRules: string[]) {
    const prompt = `
User input: ${JSON.stringify(userInput)}
Classified intent: ${JSON.stringify(classifiedIntent)}
Business rules requiring human handoff: ${businessRules.join(", ")}

Set isFiltered to true only if the user explicitly asks for one of these business rules.
Otherwise set isFiltered to false.

Return JSON only with:
- isFiltered
- reason
- confidentScore
`;
    const response = await AI_GEMINI_CLIENT.models.generateContent({
        model: AI_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(filterSchema),
        },
    });
    const parsed = filterSchema.parse(JSON.parse(response.text ?? "{}"));
    return parsed;
}

/**
 * Evaluates whether additional property knowledge must be retrieved before generating a reply.
 */
export async function needRetrieveContext(userInput: UserInput, classifiedIntent: Intent) {
    const prompt = `Based on the user's input ${JSON.stringify(userInput)} and the classified intent "${classifiedIntent}", determine if we need to retrieve more context information to better understand the user's intent. Please answer with "yes" or "no".`;
    const response = await AI_GEMINI_CLIENT.models.generateContent({
        model: AI_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(needRetrieveContextSchema),
        },
    });
    const parsed = needRetrieveContextSchema.parse(JSON.parse(response.text ?? "{}"));
    return parsed;
}

/**
 * Generates the first assistant response using the user input, detected intent and retrieved context.
 */
export async function generateResponse(userInput: UserInput, classifiedIntent: Intent, retrievedContext: string[]) {
    const prompt = `Based on the user's input ${JSON.stringify(userInput)}, the classified intent "${classifiedIntent}", and the retrieved context information ${JSON.stringify(retrievedContext)}, generate a response to reply to the user.`;
    const response = await AI_GEMINI_CLIENT.models.generateContent({
        model: AI_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(firstResponseSchema),
        },
    });
    const parsed = firstResponseSchema.parse(JSON.parse(response.text ?? "{}"));
    return parsed;
}

/**
 * Runs a guardrail pass on the generated response before it is persisted or returned to verify its quality and relevance.
 */
export async function guardrailCheck(userInput: UserInput, classifiedIntent: Intent, generatedResponse: FirstResponse) {
    const prompt = `Based on the user's input ${JSON.stringify(userInput)}, the classified intent "${classifiedIntent}", and the generated response ${JSON.stringify(generatedResponse)}, evaluate if the generated response respond of user question and that llm not hallucinate. If not, please determine if we need to ask clarification question, need to re start the conversation or need to call human agent to assist. Please answer with "appropriate", "ask_clarification", "restart" or "human_agent".`;
    const response = await AI_GEMINI_CLIENT.models.generateContent({
        model: AI_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: zodToJsonSchema(guardrailSchema),
        },
    });
    const parsed = guardrailSchema.parse(JSON.parse(response.text ?? "{}"));
    return parsed;
}

/**
 * Executes the full RAG workflow for one reservation id and one user input and persists the resulting run.
 */
export async function handleUserInput(idReservation: string, businessRules: string[], userInput: string) {
    let reservation;
    let chatHistory;
    let intentList;

    // Step 0: Load reservation, property, chat history and intent list
    try {
        const transactionResult = await db.transaction(async (tx) => {
            const [reservationResult, chatHistoryResult] = await Promise.all([
                tx
                    .select()
                    .from(reservationsTable)
                    .where(eq(reservationsTable.id, idReservation))
                    .innerJoin(propertiesTable, eq(reservationsTable.propertyId, propertiesTable.id))
                    .limit(1),
                tx
                    .select()
                    .from(chatRunsTable)
                    .where(eq(chatRunsTable.reservationId, idReservation))
                    .orderBy(desc(chatRunsTable.createdAt))
                    .limit(3),
            ]);

            if (reservationResult.length === 0) {
                throw new Error(`Reservation with id ${idReservation} not found`);
            }

            const intentListResult = await tx
                .select()
                .from(knowledgeItemsTable)
                .where(eq(knowledgeItemsTable.propertyId, reservationResult[0]!.properties.id))
                .then((results) => [...results.map((item) => item.category), "other"]);

            if (intentListResult.length === 0) {
                intentListResult.push("other");
            }

            return {
                reservation: reservationResult,
                chatHistory: chatHistoryResult,
                intentList: intentListResult,
            };
        });

        reservation = transactionResult.reservation;
        chatHistory = transactionResult.chatHistory;
        intentList = transactionResult.intentList;
    } catch (error) {
        throw new Error(`Step 0 failed while loading reservation context: ${getErrorMessage(error)}`);
    }

    // Step 1: Build the user input payload for the LLM pipeline and validate it against the schema
    let input: UserInput;
    try {
        input = {
            userMessage: userInput,
            nameProperty: reservation[0]?.properties.name || "unknown",
            addressProperty: reservation[0]?.properties.address || "unknown",
            guestName: reservation[0]?.reservations.guestName || "unknown",
            guestLanguage: reservation[0]?.reservations.guestLanguage || "unknown",
            checkInDate: typeof reservation[0]?.reservations.checkInDate === 'string' ? new Date(reservation[0].reservations.checkInDate) : reservation[0]?.reservations.checkInDate || new Date(),
            checkOutDate: typeof reservation[0]?.reservations.checkOutDate === 'string' ? new Date(reservation[0].reservations.checkOutDate) : reservation[0]?.reservations.checkOutDate || new Date(),
            conversationHistory: chatHistory.map(chat => ({
                user_message: chat.userMessage,
                detected_intent: chat.detectedIntent ?? "",
                filter: chat.filter,
                need_to_retrieve_context: chat.needToRetrieveContext,
                retrieved_context: chat.retrievedContext as any,
                first_response: chat.firstResponse as any,
                guardrail_status: chat.guardrailStatus ?? "",
                final_reply: chat.finalReply as any,
            })),
        };
        await getUserInputSchema(input);
    } catch (error) {
        throw new Error(`Step 1 failed while building or validating the user input payload: ${getErrorMessage(error)}`);
    }

    // Step 2: Classify the user intent using the LLM and the list of intents available for the property
    let classifiedIntent: Intent;
    try {
        classifiedIntent = await classifyUserIntent(input, intentList);
    } catch (error) {
        throw new Error(`Step 2 failed while classifying the user intent: ${getErrorMessage(error)}`);
    }

    // Step 3: Evaluate if the conversation needs to be routed to a human agent based on the user input, the classified intent and the business rules defined for human handoff
    let filterResult;
    try {
        filterResult = await needHumanAgent(input, classifiedIntent, businessRules);
    } catch (error) {
        throw new Error(`Step 3 failed while evaluating human handoff rules: ${getErrorMessage(error)}`);
    }
    if (filterResult.isFiltered) {
        try {
            await db.insert(chatRunsTable).values({
                id: crypto.randomUUID(),
                reservationId: idReservation,
                userMessage: input.userMessage,
                detectedIntent: classifiedIntent.intent.join(", "),
                filter: filterResult.isFiltered,
                needToRetrieveContext: false,
                guardrailStatus: "human_agent",
                finalReply: `Based on your input, we will connect you to a human agent to assist you. Reason: ${filterResult.reason}`,
            });
            return;
        } catch (error) {
            throw new Error(`Step 3 failed while persisting the filtered chat run: ${getErrorMessage(error)}`);
        }
    }

    // Step 4: Evaluate if we need to retrieve additional context information based on the user input and the classified intent
    let needRetrieveContextResult: NeedRetrieveContextResult;
    let retrievedContext: string[] | null = null;
    try {
        needRetrieveContextResult = await needRetrieveContext(input, classifiedIntent);
        if (needRetrieveContextResult.needToRetrieve && reservation[0]?.properties.id) {
            retrievedContext = await db
                .select({ content: knowledgeItemsTable.content })
                .from(knowledgeItemsTable)
                .where(and(eq(knowledgeItemsTable.propertyId, reservation[0].properties.id), inArray(knowledgeItemsTable.category, classifiedIntent.intent)))
                .orderBy(desc(knowledgeItemsTable.createdAt))
                .limit(1)
                .then((results) => results.map((item) => item.content));
        }
    } catch (error) {
        throw new Error(`Step 4 failed while retrieving additional property context: ${getErrorMessage(error)}`);
    }

    // Step 5: Generate the first assistant response using the user input, the classified intent and the retrieved context information
    let generatedResponse: FirstResponse;
    try {
        generatedResponse = await generateResponse(input, classifiedIntent, retrievedContext ? [JSON.stringify(retrievedContext)] : []);
    } catch (error) {
        throw new Error(`Step 5 failed while generating the assistant response: ${getErrorMessage(error)}`);
    }

    // Step 6: Run a guardrail check on the generated response to verify its quality and relevance before persisting or returning it
    let guardrailResult;
    try {
        guardrailResult = await guardrailCheck(input, classifiedIntent, generatedResponse);
    } catch (error) {
        throw new Error(`Step 6 failed while running the guardrail check: ${getErrorMessage(error)}`);
    }

    try {
        await db.insert(chatRunsTable).values({
            id: crypto.randomUUID(),
            reservationId: idReservation,
            userMessage: input.userMessage,
            detectedIntent: classifiedIntent.intent.join(", "),
            filter: filterResult.isFiltered,
            needToRetrieveContext: needRetrieveContextResult.needToRetrieve,
            retrievedContext: retrievedContext,
            firstResponse: generatedResponse,
            guardrailStatus: guardrailResult.guardrailStatus,
            finalReply: guardrailResult.guardrailStatus === "appropriate"
                ? generatedResponse.text
                : guardrailResult.guardrailStatus === "ask_clarification"
                    ? `We need some clarification to better assist you. ${guardrailResult.reason}`
                    : guardrailResult.guardrailStatus === "human_agent"
                        ? `Based on your input, we will connect you to a human agent to assist you. Reason: ${guardrailResult.reason}`
                        : `Let's restart the conversation. Reason: ${guardrailResult.reason}`,
        });
    } catch (error) {
        throw new Error(`Step 6 failed while persisting the chat run: ${getErrorMessage(error)}`);
    }
}
