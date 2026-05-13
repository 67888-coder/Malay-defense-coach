(async () => {
  const parts = [
    "app.part1.js",
    "app.part2.js",
    "app.part3.js",
    "app.part4.js",
    "app.part5.js",
    "app.part6.js",
    "app.part7.js",
  ];

  const scripts = await Promise.all(
    parts.map(async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Cannot load ${path}`);
      return response.text();
    }),
  );

  Function(scripts.join("\n"))();
})();