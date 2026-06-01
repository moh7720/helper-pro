const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false, timestamps: true });

const ChatSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  messages: [MessageSchema]
}, { timestamps: true });

module.exports = mongoose.model("Chat", ChatSchema);
