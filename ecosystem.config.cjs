module.exports = {
  apps: [
    {
      name:         "jalajogja",
      cwd:          "/var/www/jalajogja/apps/web",
      script:       "node_modules/.bin/next",
      args:         "start",
      instances:    1,
      exec_mode:    "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT:     "3000",
      },
    },
  ],
};
