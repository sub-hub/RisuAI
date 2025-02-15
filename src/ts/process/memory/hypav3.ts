import {
  type VectorArray,
  type memoryVector,
  HypaProcesser,
} from "./hypamemory";
import {
  type Chat,
  type character,
  type groupChat,
  getDatabase,
} from "src/ts/storage/database.svelte";
import { type OpenAIChat } from "../index.svelte";
import { requestChatData } from "../request";
import { runSummarizer } from "../transformers";
import { globalFetch } from "src/ts/globalApi.svelte";
import { parseChatML } from "src/ts/parser.svelte";
import { type ChatTokenizer } from "src/ts/tokenizer";

interface Summary {
  text: string;
  chatMemos: Set<string>;
  isImportant: boolean;
}

interface HypaV3Data {
  summaries: Summary[];
  lastSelectedSummaries?: number[];
}

export interface SerializableHypaV3Data {
  summaries: {
    text: string;
    chatMemos: string[];
    isImportant: boolean;
  }[];
  lastSelectedSummaries?: number[];
}

interface SummaryChunk {
  text: string;
  summary: Summary;
}

const minChatsForSimilarity = 3;
const maxSummarizationFailures = 3;
const summarySeparator = "\n\n";

// Helper function to check if one Set is a subset of another
function isSubset(subset: Set<string>, superset: Set<string>): boolean {
  for (const elem of subset) {
    if (!superset.has(elem)) {
      return false;
    }
  }
  return true;
}

function toSerializableHypaV3Data(data: HypaV3Data): SerializableHypaV3Data {
  return {
    ...data,
    summaries: data.summaries.map((summary) => ({
      ...summary,
      chatMemos: [...summary.chatMemos],
    })),
  };
}

function toHypaV3Data(serialData: SerializableHypaV3Data): HypaV3Data {
  return {
    ...serialData,
    summaries: serialData.summaries.map((summary) => ({
      ...summary,
      // Convert null back to undefined (JSON serialization converts undefined to null)
      chatMemos: new Set(
        summary.chatMemos.map((memo) => (memo === null ? undefined : memo))
      ),
    })),
  };
}

function encapsulateMemoryPrompt(memoryPrompt: string): string {
  return `<Past Events Summary>${memoryPrompt}</Past Events Summary>`;
}

function cleanOrphanedSummary(chats: OpenAIChat[], data: HypaV3Data): void {
  // Collect all memos from current chats
  const currentChatMemos = new Set(chats.map((chat) => chat.memo));
  const originalLength = data.summaries.length;

  // Filter summaries - keep only those whose chatMemos are subset of current chat memos
  data.summaries = data.summaries.filter((summary) => {
    return isSubset(summary.chatMemos, currentChatMemos);
  });

  const removedCount = originalLength - data.summaries.length;

  if (removedCount > 0) {
    console.log(`[HypaV3] Cleaned ${removedCount} orphaned summaries.`);
  }
}

export async function summarize(
  oaiChats: OpenAIChat[]
): Promise<{ success: boolean; data: string }> {
  const db = getDatabase();
  const stringifiedChats = oaiChats
    .map((chat) => `${chat.role}: ${chat.content}`)
    .join("\n");

  if (db.supaModelType === "distilbart") {
    try {
      const summaryText = (await runSummarizer(stringifiedChats)).trim();
      return { success: true, data: summaryText };
    } catch (error) {
      return {
        success: false,
        data: error,
      };
    }
  }

  const summarizePrompt =
    db.supaMemoryPrompt === ""
      ? "[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]"
      : db.supaMemoryPrompt;

  switch (db.supaModelType) {
    case "instruct35": {
      console.log(
        "[HypaV3] Using openAI gpt-3.5-turbo-instruct for summarization."
      );

      const requestPrompt = `${stringifiedChats}\n\n${summarizePrompt}\n\nOutput:`;
      const response = await globalFetch(
        "https://api.openai.com/v1/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + db.supaMemoryKey,
          },
          body: {
            model: "gpt-3.5-turbo-instruct",
            prompt: requestPrompt,
            max_tokens: db.maxResponse,
            temperature: 0,
          },
        }
      );

      try {
        if (!response.ok) {
          return {
            success: false,
            data: JSON.stringify(response),
          };
        }

        const summaryText =
          response.data?.choices?.[0]?.message?.content?.trim();

        if (!summaryText) {
          return {
            success: false,
            data: JSON.stringify(response),
          };
        }

        return { success: true, data: summaryText };
      } catch (error) {
        return {
          success: false,
          data: error,
        };
      }
    }

    case "subModel": {
      console.log(`[HypaV3] Using ax model ${db.subModel} for summarization.`);

      const requestMessages: OpenAIChat[] = parseChatML(
        summarizePrompt.replaceAll("{{slot}}", stringifiedChats)
      ) ?? [
        {
          role: "user",
          content: stringifiedChats,
        },
        {
          role: "system",
          content: summarizePrompt,
        },
      ];

      const response = await requestChatData(
        {
          formated: requestMessages,
          bias: {},
          useStreaming: false,
          noMultiGen: true,
        },
        "memory"
      );

      if (response.type === "streaming" || response.type === "multiline") {
        return {
          success: false,
          data: "unexpected response type",
        };
      }

      if (response.type === "fail") {
        return {
          success: false,
          data: response.result,
        };
      }

      return { success: true, data: response.result.trim() };
    }

    default: {
      return {
        success: false,
        data: `unsupported model ${db.supaModelType} for summarization`,
      };
    }
  }
}

async function retryableSummarize(
  oaiChats: OpenAIChat[]
): Promise<{ success: boolean; data: string }> {
  let summarizationFailures = 0;

  while (summarizationFailures < maxSummarizationFailures) {
    console.log(
      "[HypaV3] Attempting summarization:",
      "\nAttempt:",
      summarizationFailures + 1,
      "\nTarget:",
      oaiChats
    );

    const summarizeResult = await summarize(oaiChats);

    if (!summarizeResult.success) {
      console.log("[HypaV3] Summarization failed:", summarizeResult.data);
      summarizationFailures++;

      if (summarizationFailures >= maxSummarizationFailures) {
        return summarizeResult;
      }

      continue;
    }

    return summarizeResult;
  }
}

export async function hypaMemoryV3(
  chats: OpenAIChat[],
  currentTokens: number,
  maxContextTokens: number,
  room: Chat,
  char: character | groupChat,
  tokenizer: ChatTokenizer
): Promise<{
  currentTokens: number;
  chats: OpenAIChat[];
  error?: string;
  memory?: SerializableHypaV3Data;
}> {
  const db = getDatabase();

  // Validate settings
  if (
    db.hypaV3Settings.recentMemoryRatio + db.hypaV3Settings.similarMemoryRatio >
    1
  ) {
    return {
      currentTokens,
      chats,
      error:
        "[HypaV3] The sum of Recent Memory Ratio and Similar Memory Ratio is greater than 1.",
    };
  }

  // Initial token correction
  currentTokens -= db.maxResponse;

  // Load existing hypa data if available
  let data: HypaV3Data = {
    summaries: [],
    lastSelectedSummaries: [],
  };

  if (room.hypaV3Data) {
    data = toHypaV3Data(room.hypaV3Data);
  }

  // Clean orphaned summaries
  if (!db.hypaV3Settings.preserveOrphanedMemory) {
    cleanOrphanedSummary(chats, data);
  }

  // Determine starting index
  let startIdx = 0;

  if (data.summaries.length > 0) {
    const lastSummary = data.summaries.at(-1);
    const lastChatIndex = chats.findIndex(
      (chat) => chat.memo === [...lastSummary.chatMemos].at(-1)
    );

    if (lastChatIndex !== -1) {
      startIdx = lastChatIndex + 1;

      // Exclude tokens from summarized chats
      const summarizedChats = chats.slice(0, lastChatIndex + 1);
      for (const chat of summarizedChats) {
        currentTokens -= await tokenizer.tokenizeChat(chat);
      }
    }
  }

  // Reserve memory tokens
  const emptyMemoryTokens = await tokenizer.tokenizeChat({
    role: "system",
    content: encapsulateMemoryPrompt(""),
  });
  const memoryTokens = Math.floor(
    maxContextTokens * db.hypaV3Settings.memoryTokensRatio
  );
  const shouldReserveEmptyMemoryTokens =
    data.summaries.length === 0 &&
    currentTokens + emptyMemoryTokens <= maxContextTokens;
  let availableMemoryTokens = shouldReserveEmptyMemoryTokens
    ? 0
    : memoryTokens - emptyMemoryTokens;

  if (shouldReserveEmptyMemoryTokens) {
    currentTokens += emptyMemoryTokens;
    console.log("[HypaV3] Reserved empty memory tokens:", emptyMemoryTokens);
  } else {
    currentTokens += memoryTokens;
    console.log("[HypaV3] Reserved max memory tokens:", memoryTokens);
  }

  // If summarization is needed
  let summarizationMode = currentTokens > maxContextTokens;
  const targetTokens =
    maxContextTokens * (1 - db.hypaV3Settings.extraSummarizationRatio);

  while (summarizationMode) {
    if (currentTokens <= targetTokens) {
      break;
    }

    if (chats.length - startIdx <= minChatsForSimilarity) {
      if (currentTokens <= maxContextTokens) {
        break;
      } else {
        return {
          currentTokens,
          chats,
          error: `[HypaV3] Cannot summarize further: input token count (${currentTokens}) exceeds max context size (${maxContextTokens}), but minimum ${minChatsForSimilarity} messages required.`,
          memory: toSerializableHypaV3Data(data),
        };
      }
    }

    const toSummarize: OpenAIChat[] = [];
    const endIdx = Math.min(
      startIdx + db.hypaV3Settings.maxChatsPerSummary,
      chats.length - minChatsForSimilarity
    );
    let toSummarizeTokens = 0;

    console.log(
      "[HypaV3] Evaluating summarization batch:",
      "\nCurrent Tokens:",
      currentTokens,
      "\nMax Context Tokens:",
      maxContextTokens,
      "\nStart Index:",
      startIdx,
      "\nEnd Index:",
      endIdx,
      "\nChat Count:",
      endIdx - startIdx,
      "\nMax Chats Per Summary:",
      db.hypaV3Settings.maxChatsPerSummary
    );

    for (let i = startIdx; i < endIdx; i++) {
      const chat = chats[i];
      const chatTokens = await tokenizer.tokenizeChat(chat);

      console.log(
        "[HypaV3] Evaluating chat:",
        "\nIndex:",
        i,
        "\nRole:",
        chat.role,
        "\nContent:",
        "\n" + chat.content,
        "\nTokens:",
        chatTokens
      );

      toSummarizeTokens += chatTokens;

      if (i === 0 || !chat.content.trim()) {
        console.log(
          `[HypaV3] Skipping ${
            i === 0 ? "[Start a new chat]" : "empty content"
          } at index ${i}`
        );

        continue;
      }

      if (db.hypaV3Settings.doNotSummarizeUserMessage && chat.role === "user") {
        console.log(`[HypaV3] Skipping user role at index ${i}`);

        continue;
      }

      toSummarize.push(chat);
    }

    // Stop summarization if further reduction would go below target tokens (unless we're over max tokens)
    if (
      currentTokens <= maxContextTokens &&
      currentTokens - toSummarizeTokens < targetTokens
    ) {
      console.log(
        `[HypaV3] Stopping summarization: currentTokens(${currentTokens}) - toSummarizeTokens(${toSummarizeTokens}) < targetTokens(${targetTokens})`
      );
      break;
    }

    // Attempt summarization
    if (toSummarize.length > 0) {
      const summarizeResult = await retryableSummarize(toSummarize);

      if (!summarizeResult.success) {
        return {
          currentTokens,
          chats,
          error: `[HypaV3] Summarization failed after maximum retries: ${summarizeResult.data}`,
          memory: toSerializableHypaV3Data(data),
        };
      }

      data.summaries.push({
        text: summarizeResult.data,
        chatMemos: new Set(toSummarize.map((chat) => chat.memo)),
        isImportant: false,
      });
    }

    currentTokens -= toSummarizeTokens;
    startIdx = endIdx;
  }

  console.log(
    `[HypaV3] ${
      summarizationMode ? "Completed" : "Skipped"
    } summarization phase:`,
    "\nCurrent Tokens:",
    currentTokens,
    "\nMax Context Tokens:",
    maxContextTokens,
    "\nAvailable Memory Tokens:",
    availableMemoryTokens
  );

  // Early return if no summaries
  if (data.summaries.length === 0) {
    // Generate final memory prompt
    const memory = encapsulateMemoryPrompt("");

    const newChats: OpenAIChat[] = [
      {
        role: "system",
        content: memory,
        memo: "supaMemory",
      },
      ...chats.slice(startIdx),
    ];

    console.log(
      "[HypaV3] Exiting function:",
      "\nCurrent Tokens:",
      currentTokens,
      "\nAll chats, including memory prompt:",
      newChats,
      "\nMemory Data:",
      data
    );

    return {
      currentTokens,
      chats: newChats,
      memory: toSerializableHypaV3Data(data),
    };
  }

  const selectedSummaries: Summary[] = [];
  const randomMemoryRatio =
    1 -
    db.hypaV3Settings.recentMemoryRatio -
    db.hypaV3Settings.similarMemoryRatio;

  // Select important summaries
  const selectedImportantSummaries: Summary[] = [];

  for (const summary of data.summaries) {
    if (summary.isImportant) {
      const summaryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: summary.text + summarySeparator,
      });

      if (summaryTokens > availableMemoryTokens) {
        break;
      }

      selectedImportantSummaries.push(summary);

      availableMemoryTokens -= summaryTokens;
    }
  }

  selectedSummaries.push(...selectedImportantSummaries);

  console.log(
    "[HypaV3] After important memory selection:",
    "\nSummary Count:",
    selectedImportantSummaries.length,
    "\nSummaries:",
    selectedImportantSummaries,
    "\nAvailable Memory Tokens:",
    availableMemoryTokens
  );

  // Select recent summaries
  const reservedRecentMemoryTokens = Math.floor(
    availableMemoryTokens * db.hypaV3Settings.recentMemoryRatio
  );
  let consumedRecentMemoryTokens = 0;

  if (db.hypaV3Settings.recentMemoryRatio > 0) {
    const selectedRecentSummaries: Summary[] = [];

    // Target only summaries that haven't been selected yet
    const unusedSummaries = data.summaries.filter(
      (e) => !selectedSummaries.includes(e)
    );

    // Add one by one from the end
    for (let i = unusedSummaries.length - 1; i >= 0; i--) {
      const summary = unusedSummaries[i];
      const summaryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: summary.text + summarySeparator,
      });

      if (
        summaryTokens + consumedRecentMemoryTokens >
        reservedRecentMemoryTokens
      ) {
        break;
      }

      selectedRecentSummaries.push(summary);
      consumedRecentMemoryTokens += summaryTokens;
    }

    selectedSummaries.push(...selectedRecentSummaries);

    console.log(
      "[HypaV3] After recent memory selection:",
      "\nSummary Count:",
      selectedRecentSummaries.length,
      "\nSummaries:",
      selectedRecentSummaries,
      "\nReserved Tokens:",
      reservedRecentMemoryTokens,
      "\nConsumed Tokens:",
      consumedRecentMemoryTokens
    );
  }

  // Select similar summaries
  let reservedSimilarMemoryTokens = Math.floor(
    availableMemoryTokens * db.hypaV3Settings.similarMemoryRatio
  );
  let consumedSimilarMemoryTokens = 0;

  if (db.hypaV3Settings.similarMemoryRatio > 0) {
    const selectedSimilarSummaries: Summary[] = [];

    // Utilize unused token space from recent selection
    if (randomMemoryRatio <= 0) {
      const unusedRecentTokens =
        reservedRecentMemoryTokens - consumedRecentMemoryTokens;

      reservedSimilarMemoryTokens += unusedRecentTokens;
      console.log(
        "[HypaV3] Additional available token space for similar memory:",
        "\nFrom recent:",
        unusedRecentTokens
      );
    }

    // Target only summaries that haven't been selected yet
    const unusedSummaries = data.summaries.filter(
      (e) => !selectedSummaries.includes(e)
    );

    // Dynamically generate summary chunks
    const summaryChunks: SummaryChunk[] = [];

    unusedSummaries.forEach((summary) => {
      const splitted = summary.text
        .split("\n\n")
        .filter((e) => e.trim().length > 0);

      summaryChunks.push(
        ...splitted.map((e) => ({
          text: e.trim(),
          summary,
        }))
      );
    });

    // Fetch memory from summaryChunks
    const processor = new HypaProcesserEx(db.hypaModel);
    processor.oaikey = db.supaMemoryKey;

    // Add summaryChunks to processor for similarity search
    await processor.addSummaryChunks(summaryChunks);

    const scoredSummaries = new Map<Summary, number>();

    // (1) Raw recent chat search
    for (let i = 0; i < minChatsForSimilarity; i++) {
      const pop = chats[chats.length - i - 1];

      if (!pop) break;

      const searched = await processor.similaritySearchScoredEx(pop.content);

      for (const [chunk, similarity] of searched) {
        const summary = chunk.summary;

        scoredSummaries.set(
          summary,
          (scoredSummaries.get(summary) || 0) + similarity
        );
      }
    }

    // (2) Summarized recent chat search
    if (db.hypaV3Settings.enableSimilarityCorrection) {
      // Attempt summarization
      const recentChats = chats.slice(-minChatsForSimilarity);
      const summarizeResult = await retryableSummarize(recentChats);

      if (!summarizeResult.success) {
        return {
          currentTokens,
          chats,
          error: `[HypaV3] Summarization failed after maximum retries: ${summarizeResult.data}`,
          memory: toSerializableHypaV3Data(data),
        };
      }

      const searched = await processor.similaritySearchScoredEx(
        summarizeResult.data
      );

      for (const [chunk, similarity] of searched) {
        const summary = chunk.summary;

        scoredSummaries.set(
          summary,
          (scoredSummaries.get(summary) || 0) + similarity
        );
      }

      console.log("[HypaV3] Similarity corrected.");
    }

    // Sort in descending order
    const scoredArray = [...scoredSummaries.entries()].sort(
      ([, scoreA], [, scoreB]) => scoreB - scoreA
    );

    while (scoredArray.length > 0) {
      const [summary] = scoredArray.shift();
      const summaryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: summary.text + summarySeparator,
      });

      /*
      console.log(
        "[HypaV3] Trying to add similar summary:",
        "\nSummary Tokens:",
        summaryTokens,
        "\nConsumed Similar Memory Tokens:",
        consumedSimilarMemoryTokens,
        "\nReserved Tokens:",
        reservedSimilarMemoryTokens,
        "\nWould exceed:",
        summaryTokens + consumedSimilarMemoryTokens > reservedSimilarMemoryTokens
      );
      */

      if (
        summaryTokens + consumedSimilarMemoryTokens >
        reservedSimilarMemoryTokens
      ) {
        console.log(
          `[HypaV3] Stopping similar memory selection: consumedSimilarMemoryTokens(${consumedSimilarMemoryTokens}) + summaryTokens(${summaryTokens}) > reservedSimilarMemoryTokens(${reservedSimilarMemoryTokens})`
        );
        break;
      }

      selectedSimilarSummaries.push(summary);
      consumedSimilarMemoryTokens += summaryTokens;
    }

    selectedSummaries.push(...selectedSimilarSummaries);

    console.log(
      "[HypaV3] After similar memory selection:",
      "\nSummary Count:",
      selectedSimilarSummaries.length,
      "\nSummaries:",
      selectedSimilarSummaries,
      "\nReserved Tokens:",
      reservedSimilarMemoryTokens,
      "\nConsumed Tokens:",
      consumedSimilarMemoryTokens
    );
  }

  // Select random summaries
  let reservedRandomMemoryTokens = Math.floor(
    availableMemoryTokens * randomMemoryRatio
  );
  let consumedRandomMemoryTokens = 0;

  if (randomMemoryRatio > 0) {
    const selectedRandomSummaries: Summary[] = [];

    // Utilize unused token space from recent and similar selection
    const unusedRecentTokens =
      reservedRecentMemoryTokens - consumedRecentMemoryTokens;
    const unusedSimilarTokens =
      reservedSimilarMemoryTokens - consumedSimilarMemoryTokens;

    reservedRandomMemoryTokens += unusedRecentTokens + unusedSimilarTokens;
    console.log(
      "[HypaV3] Additional available token space for random memory:",
      "\nFrom recent:",
      unusedRecentTokens,
      "\nFrom similar:",
      unusedSimilarTokens,
      "\nTotal added:",
      unusedRecentTokens + unusedSimilarTokens
    );

    // Target only summaries that haven't been selected yet
    const unusedSummaries = data.summaries
      .filter((e) => !selectedSummaries.includes(e))
      .sort(() => Math.random() - 0.5); // Random shuffle

    for (const summary of unusedSummaries) {
      const summaryTokens = await tokenizer.tokenizeChat({
        role: "system",
        content: summary.text + summarySeparator,
      });

      if (
        summaryTokens + consumedRandomMemoryTokens >
        reservedRandomMemoryTokens
      ) {
        // Trying to select more random memory
        continue;
      }

      selectedRandomSummaries.push(summary);
      consumedRandomMemoryTokens += summaryTokens;
    }

    selectedSummaries.push(...selectedRandomSummaries);

    console.log(
      "[HypaV3] After random memory selection:",
      "\nSummary Count:",
      selectedRandomSummaries.length,
      "\nSummaries:",
      selectedRandomSummaries,
      "\nReserved Tokens:",
      reservedRandomMemoryTokens,
      "\nConsumed Tokens:",
      consumedRandomMemoryTokens
    );
  }

  // Sort selected summaries chronologically (by index)
  selectedSummaries.sort(
    (a, b) => data.summaries.indexOf(a) - data.summaries.indexOf(b)
  );

  // Generate final memory prompt
  const memory = encapsulateMemoryPrompt(
    selectedSummaries.map((e) => e.text).join(summarySeparator)
  );
  const realMemoryTokens = await tokenizer.tokenizeChat({
    role: "system",
    content: memory,
  });

  // Release reserved memory tokens
  if (shouldReserveEmptyMemoryTokens) {
    currentTokens -= emptyMemoryTokens;
  } else {
    currentTokens -= memoryTokens;
  }

  currentTokens += realMemoryTokens;

  console.log(
    "[HypaV3] Final memory selection:",
    "\nSummary Count:",
    selectedSummaries.length,
    "\nSummaries:",
    selectedSummaries,
    "\nReal Memory Tokens:",
    realMemoryTokens,
    "\nAvailable Memory Tokens:",
    availableMemoryTokens
  );

  if (currentTokens > maxContextTokens) {
    throw new Error(
      `[HypaV3] Unexpected error: input token count (${currentTokens}) exceeds max context size (${maxContextTokens})`
    );
  }

  // Save last selected summaries
  data.lastSelectedSummaries = selectedSummaries.map((selectedSummary) =>
    data.summaries.findIndex((summary) => summary === selectedSummary)
  );

  const newChats: OpenAIChat[] = [
    {
      role: "system",
      content: memory,
      memo: "supaMemory",
    },
    ...chats.slice(startIdx),
  ];

  console.log(
    "[HypaV3] Exiting function:",
    "\nCurrent Tokens:",
    currentTokens,
    "\nAll chats, including memory prompt:",
    newChats,
    "\nMemory Data:",
    data
  );

  return {
    currentTokens,
    chats: newChats,
    memory: toSerializableHypaV3Data(data),
  };
}

type SummaryChunkVector = {
  chunk: SummaryChunk;
  vector: memoryVector;
};

class HypaProcesserEx extends HypaProcesser {
  // Maintain references to SummaryChunks and their associated memoryVectors
  summaryChunkVectors: SummaryChunkVector[] = [];

  // Calculate dot product similarity between two vectors
  similarity(a: VectorArray, b: VectorArray): number {
    let dot = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }

    return dot;
  }

  async addSummaryChunks(chunks: SummaryChunk[]): Promise<void> {
    // Maintain the superclass's caching structure by adding texts
    const texts = chunks.map((chunk) => chunk.text);

    await this.addText(texts);

    // Create new SummaryChunkVectors
    const newSummaryChunkVectors: SummaryChunkVector[] = [];

    for (const chunk of chunks) {
      const vector = this.vectors.find((v) => v.content === chunk.text);

      if (!vector) {
        throw new Error(
          `Failed to create vector for summary chunk:\n${chunk.text}`
        );
      }

      newSummaryChunkVectors.push({
        chunk,
        vector,
      });
    }

    // Append new SummaryChunkVectors to the existing collection
    this.summaryChunkVectors.push(...newSummaryChunkVectors);
  }

  async similaritySearchScoredEx(
    query: string
  ): Promise<[SummaryChunk, number][]> {
    const queryVector = (await this.getEmbeds(query))[0];

    return this.summaryChunkVectors
      .map((scv) => ({
        chunk: scv.chunk,
        similarity: this.similarity(queryVector, scv.vector.embedding),
      }))
      .sort((a, b) => (a.similarity > b.similarity ? -1 : 0))
      .map((result) => [result.chunk, result.similarity]);
  }
}
