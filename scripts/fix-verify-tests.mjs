import fs from "node:fs";

const file = "scripts/verify-modules.mjs";
let src = fs.readFileSync(file, "utf8");

// Fix AI status test
src = src.replace(
  `record(
    "AI durumu okundu ve Ollama etkin",
    aiStatus.status === 200 && aiStatus.json?.enabled === false,
    \`provider=\${aiStatus.json?.provider}\`,
  );`,
  `record(
    "AI durumu okundu ve Ollama etkin",
    aiStatus.status === 200 && aiStatus.json?.enabled === true && aiStatus.json?.provider === "ollama",
    \`provider=\${aiStatus.json?.provider} enabled=\${aiStatus.json?.enabled}\`,
  );`
);

// Fix AI message test - should succeed now
src = src.replace(
  `record(
    "AI kapaliyken mesaj reddedildi (ai_disabled)",
    message.status === 409 && message.json?.code === "ai_disabled",
    \`HTTP \${message.status}\`,
  );`,
  `record(
    "AI acikken mesaj gonderilebiliyor",
    message.status === 201 || message.status === 200,
    \`HTTP \${message.status}\`,
  );`
);

fs.writeFileSync(file, src, "utf8");
console.log("verify-modules updated");