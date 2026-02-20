import { insightsReportsStyles } from "./insights-reports-styles.js";
import { insightsReportsScript } from "./insights-reports-script.js";

export default function getInsightsReportsPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="app">
    <main class="main">
      <div id="main-top"></div>
      <div id="main-extra"></div>
      <div class="content">
        <div id="status" class="status"></div>
        <div id="insights-root"></div>
      </div>
    </main>
  </div>

`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem - Insights Reports</title>
${insightsReportsStyles}
${bodyHtml}
${insightsReportsScript}
</body>
</html>`;
}
