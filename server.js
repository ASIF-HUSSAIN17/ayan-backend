// // // require("dotenv").config();
// // // const express = require("express");
// // // const cors = require("cors");
// // // const bodyParser = require("body-parser");

// // // const authRoutes = require("./auth");
// // // const walletRoutes = require("./wallet");

// // // const app = express();
// // // app.use(cors());
// // // app.use(bodyParser.json());

// // // app.use("/auth", authRoutes);
// // // app.use("/", walletRoutes);

// // // const PORT = process.env.PORT || 5000;
// // // app.listen(PORT, "0.0.0.0", () => {
// // //   console.log(`Server running on http://0.0.0.0:${PORT}`);
// // // });

// // require("dotenv").config();
// // const express = require("express");
// // const cors = require("cors");
// // const bodyParser = require("body-parser");
// // const net = require("net");

// // const authRoutes = require("./auth");
// // const walletRoutes = require("./wallet");

// // const app = express();
// // app.use(cors());
// // app.use(bodyParser.json());

// // // ---- Auth & Wallet ----
// // app.use("/auth", authRoutes);
// // app.use("/", walletRoutes);

// // // ---- Devices (merged here) ----
// // const FING_HOST = "127.0.0.1";
// // const FING_PORT = 49090;
// // const FING_PATH = "/1/devices?auth=fing_loc_api123";

// // function getConnectedDuration(firstSeen) {
// //   if (!firstSeen) return null;
// //   const first = new Date(firstSeen);
// //   const now = new Date();
// //   return Math.floor((now - first) / 1000 / 60); // minutes
// // }

// // app.get("/devices", (req, res) => {
// //   const client = net.createConnection(
// //     { host: FING_HOST, port: FING_PORT },
// //     () => {
// //       client.write(`GET ${FING_PATH} HTTP/1.1\r\nHost: ${FING_HOST}\r\n\r\n`);
// //     }
// //   );

// //   let rawData = "";
// //   client.on("data", (chunk) => {
// //     rawData += chunk.toString();
// //   });

// //   client.on("end", () => {
// //     try {
// //       const parts = rawData.split("\r\n\r\n");
// //       const body = parts[1];
// //       const json = JSON.parse(body);

// //       const devices = (json.devices || []).map((d) => ({
// //         mac: d.mac,
// //         name: d.name || "(no name)",
// //         type: d.type || "UNKNOWN",
// //         ip: Array.isArray(d.ip) ? d.ip.join(", ") : d.ip || "",
// //         make: d.make || "",
// //         model: d.model || "",
// //         first_seen: d.first_seen,
// //         connected_minutes: getConnectedDuration(d.first_seen),
// //       }));

// //       res.json({ devices });
// //     } catch (err) {
// //       console.error("Parse error:", err.message);
// //       res.status(500).json({ error: "Invalid JSON from Fing API", raw: rawData });
// //     }
// //   });

// //   client.on("error", (err) => {
// //     console.error("Socket error:", err.message);
// //     res.status(500).json({ error: err.message });
// //   });
// // });

// // // ---- Start server ----
// // const PORT = process.env.PORT || 5000;
// // app.listen(PORT, "0.0.0.0", () => {
// //   console.log(`Server running on http://0.0.0.0:${PORT}`);
// // });
// const express = require("express");
// const cors = require("cors");
// const bodyParser = require("body-parser");

// const authRoutes = require("./auth");
// const walletRoutes = require("./wallet");
// const deviceRoutes = require("./device"); // 👈 import router

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// app.use("/auth", authRoutes);
// app.use("/", walletRoutes);
// app.use("/devices", deviceRoutes); // 👈 mount router

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`Server running on http://0.0.0.0:${PORT}`);
// });
const express = require("express");
const authRoutes = require("./auth");
const walletRoutes = require("./wallet");
const deviceRoutes = require("./device"); // device.js import

const app = express();
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/", walletRoutes); // wallet routes like /wallet, /create-order, etc
app.use("/", deviceRoutes); // devices route

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
