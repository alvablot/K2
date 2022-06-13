const uuid = require("uuid");
const md5 = require("md5");
const jwt = require("jsonwebtoken");
const db = require("../database.js");
let users;
let token = false;
let activeUser = {};
const fetchBooksTable = "SELECT * FROM books";
const fetchTable = "SELECT * FROM users";
const fetchBooks = "SELECT * FROM books";
const deleteRow = "DELETE FROM users";
const insertRow = "INSERT INTO users";
const updateRow = "UPDATE users";
const bookUserId = "UPDATE books";

function initTable(query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      resolve(rows);
    });
  });
}

function getUser(query) {
  return new Promise((resolve, reject) => {
    db.get(query, (err, rows) => {
      resolve(rows);
    });
  });
}

async function getAll() {
  const query = fetchTable;
  const result = await initTable(query);
  return result;
}

async function borrowedBooks(id) {
  const query = `SELECT * FROM books WHERE user_id = '${id}'`;
  const result = await initTable(query);
  return result;
}

async function getOne() {
  if (!activeUser.id) return 403;
  const id = activeUser.id;
  const query = `${fetchTable} WHERE id = '${id}'`;
  let user = await getUser(query);
  let books = await borrowedBooks(id);
  books = Object.assign(books);
  const result = {
    user,
    books,
  };
  return result;
}

async function addOne(data) {
  const { first_name, last_name, email, password } = data;
  if (!first_name || !last_name || !email || !password) return 400;
  const existingUser = await getUser(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  if (existingUser !== undefined) {
    if (email === existingUser.email) return 409;
  }
  const query = `${insertRow} (id, first_name, last_name, email, password)  VALUES(?, ?, ?, ?, ?)`;
  db.run(query, [uuid.v4(), first_name, last_name, email, md5(password)]);
  users = initTable(fetchTable);
  return users;
}

async function login(id, data) {
  const { email, password } = data;
  if (!email || !password) return 400;

  const existingUser = await getUser(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  if (existingUser === undefined) return 404;
  const hashedPassword = md5(password);
  const checkPassword = await getUser(
    `SELECT * FROM users WHERE password = '${hashedPassword}'`
  );
  if (checkPassword === undefined) return 404;

  //////// INLOGGAD
  console.log("Right password");
  token = jwt.sign(
    {
      id: existingUser.id,
      //username: existingUser.username,
      email: existingUser.email,
    },
    process.env.SECRET_KEY
  );
  activeUser = {
    id: existingUser.id,
    password: hashedPassword,
  };
  return token;
}

async function lendOne(bookId) {
  let user;
  const id = activeUser.id;
  if (!token) return 403;
  if (!bookId) return 404;
  
  const avaiableBook = `SELECT available FROM books WHERE id = '${bookId}'`;
  let result = await getUser(avaiableBook);
  console.log(result);
  const bookAvailable = (await result) !== "false";
  console.log(bookAvailable);

  if (bookAvailable) {
    db.run(
      `
  UPDATE books SET user_id = ?
    WHERE id = ?`,
      [id, bookId]
    );
    user = await getOne(id);
  } else {
    user = "Boken är inte tillgänglig";
  }
  return user;
  
}

async function returnOne(bookId) {
  const id = activeUser.id;
  if (!token) return 403;
  if (!bookId) return 404;
  db.run(
    `
  UPDATE books SET avaiable, user_id = ?, ?
    WHERE id = ?`,
    ["true", "NULL", bookId]
  ); 
  const user = await getOne(id);
  return user;
}

async function deleteOne(id) {
  db.run(`${deleteRow} WHERE id = ?`, id, (err) => {});
  users = initTable(fetchTable);
  return users;
}

async function patchOne(id, data) {
  function updatePart(col, data) {
    db.run(
      `${updateRow}
      SET ${col} = ?
      WHERE id = ?`,
      [data, id]
    );
  }
  if (data.first_name !== undefined) {
    updatePart("first_name", data.first_name);
  }
  if (data.last_name !== undefined) {
    updatePart("last_name", data.last_name);
  }
  const users = await initTable(fetchTable);
  return users;
}

module.exports = {
  users,
  getAll,
  getOne,
  addOne,
  login,
  lendOne,
  returnOne,
  deleteOne,
  patchOne,
};
