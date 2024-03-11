import mongoose from 'mongoose';
import express from 'express';
import Thread from './model/thread.js';
import cors from 'cors';
import timeout from 'connect-timeout';
import "dotenv/config.js"
import OpenAI from "openai";

const API_KEY = process.env.AI_KEY;

const openai = new OpenAI({apiKey: API_KEY,
  dangerouslyAllowBrowser: true});

const app = express();
const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get("/", (req, res) => {
  res.send("server is running");
})


app.use(express.json());
app.use(cors());
app.use(timeout('10s'));

app.post("/api/init-chat/", async (req, res) => {
  try {
    const { message } = req.body;
    const assistantId = "asst_9baNgmXjR1e9tFitiE9AYewq";
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, { role: "user", content: message });
    const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistant.id });

    const respose_message = await checkStatus(thread.id, run.id);
    res.json(respose_message)
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});


async function checkStatus(threadId, runId) {
  let isComplete = false;
  while (!isComplete) {
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    if (runStatus.status === "completed") {
      isComplete = true;
      const messages = await openai.beta.threads.messages.list(threadId);
      for (const msg of messages.data) {
        if (msg.role === 'assistant' && msg.content && msg.content.length > 0 && msg.content[0].text && msg.content[0].text.value) {
          const assistantResponse = msg.content[0].text.value;
          return { message: assistantResponse };  
        }
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return { message: "No response from assistant." };  
}

app.post("/api/create-thread", haltOnTimedout, async (req, res) => {
  try {
    const { thread_id } = req.body;
    const newThread = new Thread({ thread_id, messages: [] });
    await newThread.save();
    res.status(201).json({ thread_id: newThread.thread_id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.post("/api/threads/:threadId/add-message", async (req, res) => {
  try {
    const { content, role } = req.body;
    const thread = await Thread.findOne({ thread_id: req.params.threadId });

    if (!thread) {
      return res.status(404).send("Thread not found");
    }

    thread.messages.push({ content, role, timestamp: new Date() });
    await thread.save();

    res.status(200).json(thread);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.get("/api/threads/:threadId", async (req, res) => {
  try {
    const thread = await Thread.findOne({ thread_id: req.params.threadId });

    if (!thread) {
      return res.status(404).send("Thread not found");
    }

    res.status(200).json(thread);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});


app.post("/api/threads/:threadId/reset", async (req, res) => {
  try {
    const { threadId } = req.params.threadId;
    const thread = await Thread.findOne({ thread_id: threadId });

    if (!thread) {
      return res.status(404).send("Thread not found");
    }

    thread.messages = [];
    await thread.save();

    res.status(200).json({ message: "Thread reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

app.use((err, req, res, next) => {
  if (req.timedout) {
    console.error('Request timed out');
    return res.status(504).json({ message: 'Oh no, an error occurred. Please try again later.' });
  }
  
  console.error('An error occurred:', err);
  res.status(500).json({ message: 'Oh no, an error occurred. Please try again later.' });
});