import { insightsReportsScriptApp } from "./insights-reports-script/app.js";
import { insightsReportsScriptCommon } from "./insights-reports-script/common.js";
import { insightsReportsScriptDetail } from "./insights-reports-script/detail.js";
import { insightsReportsScriptList } from "./insights-reports-script/list.js";
import { insightsReportsScriptModel } from "./insights-reports-script/model.js";

export const insightsReportsScript = `
  <script>
${insightsReportsScriptCommon}
${insightsReportsScriptModel}
${insightsReportsScriptList}
${insightsReportsScriptDetail}
${insightsReportsScriptApp}
  </script>
`;
