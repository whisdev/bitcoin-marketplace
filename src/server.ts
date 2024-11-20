import bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';

import { connectMongoDB } from './utils/db';
import { MongoDBUrl } from './config/config';
import { checkConfirmedTx } from './utils/util';

import marketplaceRouter from './routes/marketplaceRoutes';
import poolRouter from './routes/poolRoutes';
import userRouter from './routes/userRoutes';
import testRouter from './routes/testRoutes';


const PORT = process.env.PORT || 5000;

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

const server = http.createServer(app);

// Set up Cross-Origin Resource Sharing (CORS) options
app.use(cors())

// Socket.io
export const io = new Server(server, { cors: { origin: "*" } });
// End Socket

io.on("connection", (socket) => {
  console.log("socket connected");
  // app.use("/api/auction", AuctionRouter(io));

  socket.on("socket test", (msg) => {
    console.log("<============= socket test ==============>");
    io.emit("socket test", msg);
  });
  socket.on("chat message", async (msg) => {
    console.log(" =========== chat message ===============>");
    io.emit("chat message", msg);
  });
  socket.on("disconnect", () => {});
  socket.on("create auction", async (msg) => {
    console.log(" =========== Create Auction ===============>");
    // const newList = await AuctionModel.aggregate([
    //   {
    //     $lookup: {
    //       from: "bids", // The collection you want to join with
    //       localField: "auctionId", // Field from the auction collection
    //       foreignField: "auctionId", // Field from the bid collection
    //       as: "bids", // Alias for the joined collection
    //     },
    //   },
    //   {
    //     $unwind: {
    //       path: "$bids", // Unwind the bids array to access each bid
    //       preserveNullAndEmptyArrays: true,
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: "$auctionId", // Group by auctionId
    //       inscriptionId: { $first: "$inscriptionId" }, // Keep the auctionInfo from the auction collection
    //       auctionName: { $first: "$auctionName" }, // Keep the auctionInfo from the auction collection
    //       auctionId: { $first: "$auctionId" }, // Keep the auctionInfo from the auction collection
    //       startDate: { $first: "$startDate" }, // Keep the auctionInfo from the auction collection
    //       endDate: { $first: "$endDate" }, // Keep the auctionInfo from the auction collection
    //       initialPrice: { $first: "$initialPrice" }, // Keep the auctionInfo from the auction collection
    //       ended: { $first: "$ended" }, // Keep the auctionInfo from the auction collection
    //       auctionCreator: { $first: "$auctionCreator" }, // Keep the auctionInfo from the auction collection
    //       currentBid: { $max: "$bids.amount" }, // Get the maximum bid from the bids
    //       biders: { $addToSet: "$bids.bider" },
    //       winner: { $first: "$winner" },
    //       refunded: { $first: "$refunded" },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0, // Exclude the _id field
    //       auctionId: 1,
    //       inscriptionId: 1,
    //       auctionName: 1,
    //       startDate: 1,
    //       endDate: 1,
    //       initialPrice: 1,
    //       ended: 1,
    //       auctionCreator: 1,
    //       currentBid: 1,
    //       biders: 1,
    //       winner: 1,
    //       refunded: 1,
    //     },
    //   },
    // ]);
    // io.emit("create auction", newList);
    io.emit("create auction", "sdsds");
  });
});

checkConfirmedTx();

app.use('/api/marketplace', marketplaceRouter);
app.use('/api/pool', poolRouter);
app.use('/api/user', userRouter);
app.use('/api/test', testRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// cron.schedule("*/10 * * * *", async () => {
//   console.log("running a task every 10 minute");
//   await checkTxStatus();
// });

export default app;