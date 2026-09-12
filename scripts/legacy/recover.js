const fs = require('fs');
const path = require('path');

const agents = [
  { ep: 'ep01', id: '8535da4e-d8c2-4056-ab4b-e03dc3bfc795', date: '2024-04-11' },
  { ep: 'ep02', id: 'df7e48ed-abd9-4d8f-b0b1-628c981082e2', date: '2024-04-25' },
  { ep: 'ep03', id: 'c4dfc1fc-cb94-476d-930f-527d790e4be8', date: '2024-05-09' },
  { ep: 'ep04', id: 'ec7349e5-7546-4fc5-95e0-f293a46bc305', date: '2024-05-23' },
  { ep: 'ep05', id: '49a86740-f6cf-4324-a9e4-8ca85d3b6bd4', date: '2024-06-13' },
  { ep: 'ep06', id: 'a2b641e6-89b9-4cc6-bf95-f9781bda7a84', date: '2024-06-27' },
  { ep: 'ep07', id: '449da9d2-eba9-4164-96f0-c600736706f3', date: '2024-07-11' },
];

const outDir = path.join(__dirname, 'content', 'episodes');

agents.forEach(agent => {
  const logPath = `C:/Users/Jonathan/.gemini/antigravity/brain/${agent.id}/.system_generated/logs/transcript_full.jsonl`;
  if (!fs.existsSync(logPath)) {
    console.log(`Missing log for ${agent.ep}`);
    return;
  }

  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  let recoveredContent = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      if (data.tool_calls) {
        const writeCall = data.tool_calls.find(c => c.name === 'write_to_file' && c.args.TargetFile && c.args.TargetFile.includes('ep'));
        if (writeCall) {
          recoveredContent = writeCall.args.CodeContent;
        }
      }
    } catch(e) {}
  }

  if (recoveredContent) {
    // Replace the date
    recoveredContent = recoveredContent.replace(/date:\s*".*?"/, `date: "${agent.date}"`);
    
    // Fix episode number if needed (e.g., episode: 01 -> episode: 1 to be cleaner)
    recoveredContent = recoveredContent.replace(/episode:\s*0?(\d)/, `episode: $1`);

    fs.writeFileSync(path.join(outDir, `${agent.ep}.md`), recoveredContent, 'utf8');
    console.log(`Recovered ${agent.ep}.md`);
  } else {
    console.log(`Failed to find write_to_file args for ${agent.ep}`);
  }
});
