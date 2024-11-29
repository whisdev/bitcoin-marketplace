import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";

import { connectMongoDB } from "./utils/db";
import { MongoDBUrl } from "./config/config";
import { checkConfirmedTx } from "./utils/util";

import marketplaceRouter from "./routes/marketplaceRoutes";
import poolRouter from "./routes/poolRoutes";
import userRouter from "./routes/userRoutes";
import testRouter from "./routes/testRoutes";

const PORT = process.env.PORT || 9030;

// Connect to the MongoDB database
connectMongoDB(MongoDBUrl as string);

// Create an instance of the Express application
const app = express();

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "./public")));

// Parse incoming JSON requests using body-parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Set up Cross-Origin Resource Sharing (CORS) options
// app.use(cors())
app.use(cors({ origin: "*" }));

checkConfirmedTx();

app.use("/api/marketplace", marketplaceRouter);
app.use("/api/pool", poolRouter);
app.use("/api/user", userRouter);
app.use("/api/test", testRouter);

// Socket.io
const server = http.createServer(app);
export const io = new Server(server, { cors: { origin: "*" } });
// End Socket

app.set("io", io);

io.on("connection", (socket) => {
	console.log(`socket connected: ${socket.id}`);
});

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
