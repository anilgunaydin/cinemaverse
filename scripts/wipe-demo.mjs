/** Parcali durmus seed-demo kalintilarini temizler (demo-* e-postali kullanicilar + cocuk satirlar). */
import Database from "better-sqlite3";

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const users = db
  .prepare("SELECT id FROM users WHERE email LIKE 'demo-%@cinemaverse.local'")
  .all()
  .map((u) => u.id);

if (users.length === 0) {
  console.log("Demo kullanici yok; temizlenacak bir sey bulunmadi.");
  db.close();
  process.exit(0);
}
const inIds = users.map(() => "?").join(", ");

const deletes = [
  ["reviews", `DELETE FROM reviews WHERE user_id IN (${inIds})`],
  ["review_replies", `DELETE FROM review_replies WHERE user_id IN (${inIds})`],
  ["likes", `DELETE FROM likes WHERE user_id IN (${inIds})`],
  ["discussion_threads", `DELETE FROM discussion_threads WHERE user_id IN (${inIds})`],
  ["discussion_posts", `DELETE FROM discussion_posts WHERE user_id IN (${inIds})`],
  ["user_lists", `DELETE FROM user_lists WHERE user_id IN (${inIds})`],
  ["library_entries", `DELETE FROM library_entries WHERE user_id IN (${inIds})`],
  ["follows", `DELETE FROM follows WHERE follower_id IN (${inIds}) OR following_id IN (${inIds})`, 2],
  ["reports", `DELETE FROM reports WHERE reporter_id IN (${inIds})`],
  ["users", `DELETE FROM users WHERE id IN (${inIds})`],
];
for (const [table, sql, multiplier = 1] of deletes) {
  const params = Array(multiplier).fill(users).flat();
  const info = db.prepare(sql).run(...params);
  console.log("-", table, info.changes);
}
// list_item / post / report cocuklari listeleri zaten sildi; likes mannene... Liste item cocuklari
db.prepare("DELETE FROM user_list_items WHERE list_id NOT IN (SELECT id FROM user_lists)").run();
db.prepare("DELETE FROM discussion_posts WHERE thread_id NOT IN (SELECT id FROM discussion_threads)").run();
db.prepare("DELETE FROM review_replies WHERE review_id NOT IN (SELECT id FROM reviews)").run();
console.log("Cocuk satirlar temizlendi.");
db.close();
