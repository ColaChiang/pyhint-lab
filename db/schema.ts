import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userKey: text("user_key").notNull(),
  problemId: text("problem_id").notNull(),
  code: text("code").notNull(),
  passed: integer("passed").notNull(),
  total: integer("total").notNull(),
  ruleId: text("rule_id"),
  hintLevel: integer("hint_level").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
