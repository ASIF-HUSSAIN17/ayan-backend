// device.js
const express = require("express");
const net = require("net");
const router = express.Router();

const FING_HOST = "127.0.0.1";
const FING_PORT = 49090;
const FING_PATH = "/1/devices?auth=fing_loc_api123";

function getConnectedDuration(firstSeen) {
  if (!firstSeen) return null;
  const first = new Date(firstSeen);
  const now = new Date();
  return Math.floor((now - first) / 1000 / 60); // minutes
}

router.get("/devices", (req, res) => {
  const client = net.createConnection(
    { host: FING_HOST, port: FING_PORT },
    () => {
      client.write(`GET ${FING_PATH} HTTP/1.1\nHost: ${FING_HOST}\n\n`);
    }
  );

  let rawData = "";
  client.on("data", (chunk) => {
    rawData += chunk.toString();
  });

  client.on("end", () => {
    try {
      const parts = rawData.split("\n\n");
      const body = parts[1];
      const json = JSON.parse(body);

      const devices = (json.devices || []).map((d) => ({
        mac: d.mac,
        name: d.name || "(no name)",
        type: d.type || "UNKNOWN",
        ip: Array.isArray(d.ip) ? d.ip.join(", ") : d.ip || "",
        make: d.make || "",
        model: d.model || "",
        first_seen: d.first_seen,
        connected_minutes: getConnectedDuration(d.first_seen),
      }));

      res.json({ devices });
    } catch (err) {
      console.error("Parse error:", err.message);
      res.status(500).json({ error: "Invalid JSON from Fing API", raw: rawData });
    }
  });

  client.on("error", (err) => {
    console.error("Socket error:", err.message);
    res.status(500).json({ error: err.message });
  });
});

module.exports = router;
