const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "discord-game-bot",
      cwd: __dirname,
      script: path.join(__dirname, "dist", "mafia", "src", "index.js"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      kill_timeout: 5000,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
