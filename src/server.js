"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const db_1 = require("./utils/db");
const config_1 = require("./config/config");
const util_1 = require("./utils/util");
const marketplaceRoutes_1 = __importDefault(require("./routes/marketplaceRoutes"));
const poolRoutes_1 = __importDefault(require("./routes/poolRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const testRoutes_1 = __importDefault(require("./routes/testRoutes"));
const PORT = process.env.PORT || 9030;
// Connect to the MongoDB database
(0, db_1.connectMongoDB)(config_1.MongoDBUrl);
// Create an instance of the Express application
const app = (0, express_1.default)();
// Serve static files from the 'public' folder
app.use(express_1.default.static(path_1.default.join(__dirname, "./public")));
// Parse incoming JSON requests using body-parser
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use(body_parser_1.default.json({ limit: "50mb" }));
app.use(body_parser_1.default.urlencoded({ limit: "50mb", extended: true }));
// Set up Cross-Origin Resource Sharing (CORS) options
// app.use(cors())
app.use((0, cors_1.default)({ origin: "*" }));
(0, util_1.checkConfirmedTx)();
app.use("/api/marketplace", marketplaceRoutes_1.default);
app.use("/api/pool", poolRoutes_1.default);
app.use("/api/user", userRoutes_1.default);
app.use("/api/test", testRoutes_1.default);
// Socket.io
const server = http_1.default.createServer(app);
exports.io = new socket_io_1.Server(server, { cors: { origin: "*" } });
// End Socket
app.set("io", exports.io);
exports.io.on("connection", (socket) => {
    console.log(`socket connected: ${socket.id}`);
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.default = app;
