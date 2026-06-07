var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_mongodb = require("mongodb");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var localDb = {
  settings: {
    adminPassword: "1234",
    examCenter: "MANSHAU CAMPUS MAIN CENTER",
    subjectTypes: ["Theory", "Practical", "Internal", "Other"]
  },
  subjects: [
    { id: "1", name: "English", maxMarks: 100, passMarks: 35, type: "Theory" },
    { id: "2", name: "Maths", maxMarks: 100, passMarks: 35, type: "Theory" },
    { id: "3", name: "Science", maxMarks: 100, passMarks: 35, type: "Theory" },
    { id: "4", name: "Social", maxMarks: 100, passMarks: 35, type: "Theory" },
    { id: "5", name: "Computer", maxMarks: 100, passMarks: 35, type: "Theory" }
  ],
  students: [],
  attendance: [],
  notifications: [
    {
      id: "notif-1",
      title: "Welcome to Exam Student Portal",
      content: "All upcoming midterm schedule records and hall ticket release status updates will be published here.",
      date: "2026-06-04",
      important: true
    }
  ]
};
var mongoClient = null;
var connectionError = null;
async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    connectionError = "MONGODB_URI environment variable is missing";
    return null;
  }
  try {
    if (!mongoClient) {
      mongoClient = new import_mongodb.MongoClient(uri, {
        connectTimeoutMS: 5e3,
        serverSelectionTimeoutMS: 5e3
      });
      await mongoClient.connect();
      console.log("Successfully connected to MongoDB!");
      connectionError = null;
    }
    return mongoClient.db();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    connectionError = err.message;
    mongoClient = null;
    return null;
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.get("/api/db-status", async (req, res) => {
    const uri = process.env.MONGODB_URI;
    const db = await getMongoDb();
    const obfuscatedUri = uri ? uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") : null;
    res.json({
      isConfigured: !!uri,
      isConnected: !!db,
      error: connectionError,
      uri: obfuscatedUri,
      provider: "MongoDB"
    });
  });
  app.get("/api/data", async (req, res) => {
    try {
      const db = await getMongoDb();
      if (db) {
        const students = await db.collection("students").find({}).toArray();
        const subjects = await db.collection("subjects").find({}).toArray();
        const attendance = await db.collection("attendance").find({}).toArray();
        const notifications = await db.collection("notifications").find({}).toArray();
        let settingsObj = await db.collection("settings").findOne({ id: "admin" });
        if (!settingsObj) {
          settingsObj = { id: "admin", ...localDb.settings };
          await db.collection("settings").insertOne(settingsObj);
        }
        res.json({
          success: true,
          students: students.map(({ _id, ...rest }) => rest),
          subjects: subjects.map(({ _id, ...rest }) => rest),
          attendance: attendance.map(({ _id, ...rest }) => rest),
          notifications: notifications.map(({ _id, ...rest }) => rest),
          settings: {
            adminPassword: settingsObj.adminPassword,
            examCenter: settingsObj.examCenter,
            subjectTypes: settingsObj.subjectTypes
          }
        });
      } else {
        res.json({
          success: true,
          students: localDb.students,
          subjects: localDb.subjects,
          attendance: localDb.attendance,
          notifications: localDb.notifications,
          settings: localDb.settings,
          isUsingFallback: true,
          error: "MongoDB is not connected. Running in-memory sandbox storage."
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/save", async (req, res) => {
    const { collectionName, id, data } = req.body;
    if (!collectionName || !id) {
      return res.status(400).json({ success: false, error: "Missing collectionName or id" });
    }
    try {
      const db = await getMongoDb();
      if (db) {
        const query = collectionName === "settings" ? { id: "admin" } : { id };
        const cleanData = { ...data };
        delete cleanData._id;
        await db.collection(collectionName).updateOne(
          query,
          { $set: cleanData },
          { upsert: true }
        );
        res.json({ success: true, message: `Successfully saved to ${collectionName}` });
      } else {
        if (collectionName === "settings") {
          localDb.settings = data;
        } else if (collectionName === "students") {
          const index = localDb.students.findIndex((s) => s.id === id || s.docId === id);
          if (index > -1) {
            localDb.students[index] = { ...localDb.students[index], ...data };
          } else {
            localDb.students.push(data);
          }
        } else if (collectionName === "subjects") {
          const index = localDb.subjects.findIndex((s) => s.id === id);
          if (index > -1) {
            localDb.subjects[index] = { ...localDb.subjects[index], ...data };
          } else {
            localDb.subjects.push(data);
          }
        } else if (collectionName === "attendance") {
          const index = localDb.attendance.findIndex((a) => a.id === id);
          if (index > -1) {
            localDb.attendance[index] = { ...localDb.attendance[index], ...data };
          } else {
            localDb.attendance.push(data);
          }
        } else if (collectionName === "notifications") {
          const index = localDb.notifications.findIndex((n) => n.id === id);
          if (index > -1) {
            localDb.notifications[index] = { ...localDb.notifications[index], ...data };
          } else {
            localDb.notifications.push(data);
          }
        }
        res.json({ success: true, isUsingFallback: true, message: `Saved locally to temporary sandbox` });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/delete", async (req, res) => {
    const { collectionName, id } = req.body;
    if (!collectionName || !id) {
      return res.status(400).json({ success: false, error: "Missing collectionName or id" });
    }
    try {
      const db = await getMongoDb();
      if (db) {
        const query = collectionName === "students" ? { $or: [{ id }, { docId: id }] } : { id };
        await db.collection(collectionName).deleteOne(query);
        res.json({ success: true, message: `Successfully deleted from ${collectionName}` });
      } else {
        if (collectionName === "students") {
          localDb.students = localDb.students.filter((s) => s.id !== id && s.docId !== id);
        } else if (collectionName === "subjects") {
          localDb.subjects = localDb.subjects.filter((s) => s.id !== id);
        } else if (collectionName === "attendance") {
          localDb.attendance = localDb.attendance.filter((a) => a.id !== id);
        } else if (collectionName === "notifications") {
          localDb.notifications = localDb.notifications.filter((n) => n.id !== id);
        }
        res.json({ success: true, isUsingFallback: true, message: `Deleted locally from temporary sandbox` });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
