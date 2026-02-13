export const insightsReportsScriptModel = `
    function normalizeModelSettings(settings) {
      return {
        mode_default: settings && (settings.mode_default === "agent" || settings.mode_default === "external") ? settings.mode_default : "local",
        external_enabled: !!(settings && settings.external_enabled),
        provider: safeText(settings && settings.provider) || "openai-compatible",
        base_url: safeText(settings && settings.base_url) || "https://api.openai.com/v1",
        model_name: safeText(settings && settings.model_name)
      };
    }

    function modelMode() {
      var el = document.getElementById("model-mode");
      if (el && el.value) return el.value === "agent" ? "agent" : el.value === "external" ? "external" : "local";
      return modelState.settings.mode_default === "agent" ? "agent" : modelState.settings.mode_default === "external" ? "external" : "local";
    }

    function runtimeApiKey() {
      var el = document.getElementById("model-api-key");
      return el ? safeText(el.value || "").trim() : "";
    }

    function hasEffectiveApiKey() {
      return modelState.hasApiKey || runtimeApiKey().length > 0;
    }

    function isModelReadyForGeneration() {
      return (modelMode() !== "external" && modelMode() !== "agent") || hasEffectiveApiKey();
    }

    function renderModelConfigPanel() {
      var host = document.getElementById("model-config-panel");
      if (!host) return;
      var mode = modelState.settings.mode_default === "agent" ? "agent" : modelState.settings.mode_default === "external" ? "external" : "local";
      var provider = escapeHtml(modelState.settings.provider || "openai-compatible");
      var baseUrl = escapeHtml(modelState.settings.base_url || "https://api.openai.com/v1");
      var modelName = escapeHtml(modelState.settings.model_name || "");
      var disabled = (mode === "external" || mode === "agent") ? "" : " disabled";
      var badgeClass = modelState.hasApiKey ? "model-badge ok" : "model-badge";
      var badgeText = modelState.hasApiKey ? "API key configured" : "No API key configured";
      host.innerHTML =
        '<div class="model-head">' +
          '<div class="model-title">Model Configuration</div>' +
          '<span class="' + badgeClass + '">' + badgeText + '</span>' +
        '</div>' +
        '<div class="model-grid">' +
          '<div class="model-field">' +
            '<label for="model-mode">Mode</label>' +
            '<select id="model-mode">' +
              '<option value="local"' + (mode === "local" ? " selected" : "") + '>Local Analysis (no external API)</option>' +
              '<option value="external"' + (mode === "external" ? " selected" : "") + '>External API</option>' +
              '<option value="agent"' + (mode === "agent" ? " selected" : "") + '>Agent (tool calling)</option>' +
            '</select>' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-provider">Provider</label>' +
            '<input id="model-provider" type="text" value="' + provider + '"' + disabled + ' />' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-base-url">Base URL</label>' +
            '<input id="model-base-url" type="text" value="' + baseUrl + '"' + disabled + ' />' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-name">Model Name</label>' +
            '<input id="model-name" type="text" value="' + modelName + '"' + disabled + ' />' +
          '</div>' +
        '</div>' +
        '<div class="model-grid two">' +
          '<div class="model-field">' +
            '<label for="model-api-key">API Key (runtime only)</label>' +
            '<input id="model-api-key" type="password" placeholder="Not persisted; kept only in-memory for this process"' + disabled + ' />' +
          '</div>' +
          '<div class="model-actions">' +
            '<button id="btn-save-model" class="btn-ghost" type="button">Save Settings</button>' +
            '<button id="btn-test-model" class="btn-ghost" type="button">Test Connection</button>' +
            '<a href="/settings" class="btn-ghost" style="text-decoration:none;">Advanced Settings</a>' +
          '</div>' +
        '</div>' +
        '<p class="model-note">Best practice: use an env-based key in production. Runtime key is never written to the database.</p>' +
        '<div id="model-config-hint" class="model-hint"></div>';
      syncModelHint();
    }

    function syncModelHint() {
      var hint = document.getElementById("model-config-hint");
      if (!hint) return;
      if ((modelMode() === "external" || modelMode() === "agent") && !hasEffectiveApiKey()) {
        hint.className = "model-hint err";
        hint.textContent = "API key is missing. Add a runtime key or switch to Local Analysis.";
      } else if (modelMode() === "agent") {
        hint.className = "model-hint ok";
        hint.textContent = "Agent mode: LLM can call tools (search, get session, RAG) to generate targeted insights.";
      } else if (modelMode() === "external") {
        hint.className = "model-hint ok";
        hint.textContent = "External model is ready. You can generate insights now.";
      } else {
        hint.className = "model-hint";
        hint.textContent = "Local Analysis mode uses built-in heuristics and does not require an external API key.";
      }
    }

    function modelPayloadFromForm() {
      return {
        mode: modelMode(),
        provider: safeText((document.getElementById("model-provider") || {}).value || "").trim(),
        base_url: safeText((document.getElementById("model-base-url") || {}).value || "").trim(),
        model_name: safeText((document.getElementById("model-name") || {}).value || "").trim(),
        api_key: runtimeApiKey(),
      };
    }

    function loadModelConfig() {
      return api("/api/settings/model")
        .then(function(data) {
          modelState.settings = normalizeModelSettings(data.settings || {});
          modelState.hasApiKey = !!data.has_api_key;
          renderModelConfigPanel();
          syncSelectHeader();
        })
        .catch(function(err) {
          status(err.message || "Failed to load model settings", "err");
        });
    }

    function saveModelConfig() {
      var payload = modelPayloadFromForm();
      var needsApi = payload.mode === "external" || payload.mode === "agent";
      if (needsApi && (!payload.provider || !payload.base_url || !payload.model_name)) {
        status("Provider, Base URL, and Model Name are required for external/agent mode.", "err");
        return;
      }
      status("Saving model settings...", "warn");
      api("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode_default: payload.mode,
          external_enabled: isExternal,
          provider: payload.provider,
          base_url: payload.base_url,
          model_name: payload.model_name,
          api_key: payload.api_key,
        }),
      }).then(function(data) {
        modelState.settings = normalizeModelSettings(data.settings || {});
        modelState.hasApiKey = !!data.has_api_key;
        renderModelConfigPanel();
        syncSelectHeader();
        status("Model settings saved.", "ok");
      }).catch(function(err) {
        status(err.message || "Failed to save model settings", "err");
      });
    }

    function testModelConfig() {
      var payload = modelPayloadFromForm();
      if (payload.mode !== "external") {
        status("Local mode does not require external connection testing.", "ok");
        return;
      }
      if (!payload.provider || !payload.base_url || !payload.model_name) {
        status("Provider, Base URL, and Model Name are required for external mode.", "err");
        return;
      }
      if (!hasEffectiveApiKey()) {
        status("External model API key is missing.", "err");
        var apiKeyInput = document.getElementById("model-api-key");
        if (apiKeyInput && apiKeyInput.focus) apiKeyInput.focus();
        return;
      }
      status("Testing model connection...", "warn");
      api("/api/model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: payload.provider,
          base_url: payload.base_url,
          model_name: payload.model_name,
          external_enabled: true,
          api_key: payload.api_key,
        }),
      }).then(function(out) {
        status(out.message || "Connection successful.", "ok");
      }).catch(function(err) {
        status(err.message || "Connection test failed", "err");
      });
    }
`;
