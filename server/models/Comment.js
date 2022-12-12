const { Schema, model } = require("mongoose");

const schema = new Schema(
  {
    content: { type: String, required: true },
    // на чьей странице находится коммент
    pageId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // тот кто оставил коммент
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: { CreatedAt: "created_at" },
  }
);

module.exports = model("Comment", schema);
