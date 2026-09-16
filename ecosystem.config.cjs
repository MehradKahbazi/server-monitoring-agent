module.exports = {
  apps: [
    {
      name: "server-monitor",

      script: "./dist/main.js",

      cwd: __dirname,

      instances: 1,

      exec_mode: "fork",

      autorestart: true,

      watch: false,

      max_memory_restart: "150M",

      restart_delay: 5000,

      kill_timeout: 5000,

      env: {
        NODE_ENV: "production",
      },

      time: true,

      merge_logs: true,

      out_file: "./logs/server-monitor.out.log",

      error_file: "./logs/server-monitor.error.log",

      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
