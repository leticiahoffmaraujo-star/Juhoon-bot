const fs = require("fs");

const FILE = "./mmo_db.json";

function loadDB() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE));
}

function saveDB(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function getUser(db, id) {
  if (!db[id]) {
    db[id] = {
      xp: 0,
      level: 1,
      coins: 0,
      class: "novato"
    };
  }
  return db[id];
}

module.exports = {
  loadDB,
  saveDB,
  getUser
};
