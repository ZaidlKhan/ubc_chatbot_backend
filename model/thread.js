import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema({
  thread_id: { type: String, required: true },
  messages: [{ content: String, role: String, timestamp: Date }],
});

const Thread = mongoose.model('Thread', threadSchema);

export default Thread;