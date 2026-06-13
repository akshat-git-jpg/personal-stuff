import app from './app.js';

const PORT = process.env.PORT || 8787;

app.listen(PORT, () => {
  console.log(`Personal Dashboard running at http://localhost:${PORT}`);
});
