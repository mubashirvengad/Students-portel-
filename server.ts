import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// Simple memory-based fallback database for when MongoDB is not connected/configured
const localDb = {
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
  students: [] as any[],
  attendance: [] as any[],
  notifications: [
    {
      id: "notif-1",
      title: "Welcome to Exam Student Portal",
      content: "All upcoming midterm schedule records and hall ticket release status updates will be published here.",
      date: "2026-06-04",
      important: true
    }
  ] as any[]
};

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let connectionError: string | null = null;

async function getMongoDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    connectionError = "MONGODB_URI environment variable is missing";
    return null;
  }
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClient.connect();
      console.log("Successfully connected to MongoDB!");
      connectionError = null;
    }
    return mongoClient.db();
  } catch (err: any) {
    console.error("MongoDB connection failed:", err.message);
    connectionError = err.message;
    mongoClient = null; // Reset clients so we can retry
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API - MongoDB Connection Status
  app.get("/api/db-status", async (req, res) => {
    const uri = process.env.MONGODB_URI;
    const db = await getMongoDb();
    const obfuscatedUri = uri 
      ? uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
      : null;

    res.json({
      isConfigured: !!uri,
      isConnected: !!db,
      error: connectionError,
      uri: obfuscatedUri,
      provider: "MongoDB"
    });
  });

  // API - Get All Data
  app.get("/api/data", async (req, res) => {
    try {
      const db = await getMongoDb();
      if (db) {
        const students = await db.collection("students").find({}).toArray();
        const subjects = await db.collection("subjects").find({}).toArray();
        const attendance = await db.collection("attendance").find({}).toArray();
        const notifications = await db.collection("notifications").find({}).toArray();
        
        let settingsObj: any = await db.collection("settings").findOne({ id: "admin" });
        if (!settingsObj) {
          settingsObj = { id: "admin", ...localDb.settings };
          await db.collection("settings").insertOne(settingsObj);
        }

        // Project MongoDB _id as normal fields, convert _id from ObjectId
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
        // Fallback or local warning
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
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Save/Upsert Document
  app.post("/api/save", async (req, res) => {
    const { collectionName, id, data } = req.body;
    if (!collectionName || !id) {
      return res.status(400).json({ success: false, error: "Missing collectionName or id" });
    }

    try {
      const db = await getMongoDb();
      if (db) {
        const query = collectionName === "settings" ? { id: "admin" } : { id };
        
        // Remove MongoDB _id from incoming payload to prevent immutable index errors
        const cleanData = { ...data };
        delete cleanData._id;

        await db.collection(collectionName).updateOne(
          query,
          { $set: cleanData },
          { upsert: true }
        );
        res.json({ success: true, message: `Successfully saved to ${collectionName}` });
      } else {
        // Fallback
        if (collectionName === "settings") {
          localDb.settings = data;
        } else if (collectionName === "students") {
          const index = localDb.students.findIndex(s => s.id === id || s.docId === id);
          if (index > -1) {
            localDb.students[index] = { ...localDb.students[index], ...data };
          } else {
            localDb.students.push(data);
          }
        } else if (collectionName === "subjects") {
          const index = localDb.subjects.findIndex(s => s.id === id);
          if (index > -1) {
            localDb.subjects[index] = { ...localDb.subjects[index], ...data };
          } else {
            localDb.subjects.push(data);
          }
        } else if (collectionName === "attendance") {
          const index = localDb.attendance.findIndex(a => a.id === id);
          if (index > -1) {
            localDb.attendance[index] = { ...localDb.attendance[index], ...data };
          } else {
            localDb.attendance.push(data);
          }
        } else if (collectionName === "notifications") {
          const index = localDb.notifications.findIndex(n => n.id === id);
          if (index > -1) {
            localDb.notifications[index] = { ...localDb.notifications[index], ...data };
          } else {
            localDb.notifications.push(data);
          }
        }
        res.json({ success: true, isUsingFallback: true, message: `Saved locally to temporary sandbox` });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Delete Document
  app.post("/api/delete", async (req, res) => {
    const { collectionName, id } = req.body;
    if (!collectionName || !id) {
      return res.status(400).json({ success: false, error: "Missing collectionName or id" });
    }

    try {
      const db = await getMongoDb();
      if (db) {
        const query = collectionName === "students" 
          ? { $or: [{ id: id }, { docId: id }] }
          : { id };

        await db.collection(collectionName).deleteOne(query);
        res.json({ success: true, message: `Successfully deleted from ${collectionName}` });
      } else {
        // Fallback
        if (collectionName === "students") {
          localDb.students = localDb.students.filter(s => s.id !== id && s.docId !== id);
        } else if (collectionName === "subjects") {
          localDb.subjects = localDb.subjects.filter(s => s.id !== id);
        } else if (collectionName === "attendance") {
          localDb.attendance = localDb.attendance.filter(a => a.id !== id);
        } else if (collectionName === "notifications") {
          localDb.notifications = localDb.notifications.filter(n => n.id !== id);
        }
        res.json({ success: true, isUsingFallback: true, message: `Deleted locally from temporary sandbox` });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
