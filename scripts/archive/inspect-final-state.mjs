import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const rows = {};
rows["users"] = db.prepare("SELECT COUNT(*) c FROM users").get().c;
rows["titles"] = db.prepare("SELECT COUNT(*) c FROM titles").get().c;
rows["poster'siz kalan"] = db
  .prepare(
    "SELECT COUNT(*) c FROM titles WHERE poster_url IS NULL OR poster_url = ''"
  )
  .get().c;
rows["reviews"] = db.prepare("SELECT COUNT(*) c FROM reviews").get().c;
rows["replies"] = db.prepare("SELECT COUNT(*) c FROM review_replies").get().c;
rows["threads"] = db.prepare("SELECT COUNT(*) c FROM discussion_threads").get().c;
rows["posts"] = db.prepare("SELECT COUNT(*) c FROM discussion_posts").get().c;
rows["lists"] = db.prepare("SELECT COUNT(*) c FROM user_lists").get().c;
rows["list_items"] = db.prepare("SELECT COUNT(*) c FROM user_list_items").get().c;
rows["follows"] = db.prepare("SELECT COUNT(*) c FROM follows").get().c;
rows["reports(open)"] = db
  .prepare("SELECT COUNT(*) c FROM reports WHERE status = 'open'")
  .get().c;
rows["franchise_titles"] = db
  .prepare("SELECT COUNT(*) c FROM franchise_titles")
  .get().c;
console.log(JSON.stringify(rows, null, 1));
db.close();
