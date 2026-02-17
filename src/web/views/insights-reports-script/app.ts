export const insightsReportsScriptApp = `
    function wireGlobalEvents() {
      document.getElementById("sb-prev").addEventListener("click", function() {
        if (sidebarState.page <= 1) return;
        sidebarState.page -= 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-next").addEventListener("click", function() {
        sidebarState.page += 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-settings").addEventListener("click", function() {
        openRoute("/settings");
      });

      document.body.addEventListener("change", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-mode") {
          modelState.settings.mode_default = e.target.value === "agent" ? "agent" : e.target.value === "external" ? "external" : "local";
          renderModelConfigPanel();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("input", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-api-key") {
          syncModelHint();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("click", function(e) {
        var saveModelBtn = e.target.closest("#btn-save-model");
        if (saveModelBtn) {
          saveModelConfig();
          return;
        }
        var testModelBtn = e.target.closest("#btn-test-model");
        if (testModelBtn) {
          testModelConfig();
          return;
        }
        var viewBtn = e.target.closest(".view-report");
        if (viewBtn) {
          var card = viewBtn.closest(".report-card[data-report-id]");
          if (!card) return;
          var id = parseInt(card.getAttribute("data-report-id") || "0", 10);
          if (id > 0) openRoute("/insights/" + id);
          return;
        }
        var deleteBtn = e.target.closest(".delete-report");
        if (deleteBtn) {
          var cardDelete = deleteBtn.closest(".report-card[data-report-id]");
          if (!cardDelete) return;
          var idDelete = parseInt(cardDelete.getAttribute("data-report-id") || "0", 10);
          if (idDelete > 0) removeReport(idDelete);
          return;
        }
        var sourceTab = e.target.closest(".source-tab[data-source]");
        if (sourceTab) {
          insightState.sourceFilter = sourceTab.getAttribute("data-source") || "all";
          var tabHost = document.getElementById("source-tabs");
          if (tabHost) {
            tabHost.querySelectorAll(".source-tab").forEach(function(tab) { tab.classList.remove("active"); });
            sourceTab.classList.add("active");
          }
          var listHost = document.getElementById("candidate-list");
          if (listHost) listHost.innerHTML = renderCandidateList();
          return;
        }
        var candidate = e.target.closest(".candidate-card[data-session-id]");
        if (candidate) {
          var sid = parseInt(candidate.getAttribute("data-session-id") || "0", 10);
          if (!sid) return;
          if (insightState.selected.has(sid)) insightState.selected.delete(sid);
          else insightState.selected.add(sid);
          var listHostToggle = document.getElementById("candidate-list");
          if (listHostToggle) listHostToggle.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var selectAllBtn = e.target.closest("#btn-select-all");
        if (selectAllBtn) {
          var filtered = (insightState.candidates || []).filter(function(item) {
            return insightState.sourceFilter === "all" || item.source === insightState.sourceFilter;
          });
          var allSelected = filtered.length > 0 && filtered.every(function(item) { return insightState.selected.has(item.id); });
          if (allSelected) {
            filtered.forEach(function(item) { insightState.selected.delete(item.id); });
          } else {
            filtered.forEach(function(item) { insightState.selected.add(item.id); });
          }
          var listHostSelectAll = document.getElementById("candidate-list");
          if (listHostSelectAll) listHostSelectAll.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var generateBtn = e.target.closest("#btn-generate-report");
        if (generateBtn) {
          generateFromSelected();
          return;
        }
        var tab = e.target.closest(".tab[data-tab]");
        if (tab) {
          var route = getRouteInfo();
          if (route.view !== "detail") return;
          insightState.tab = tab.getAttribute("data-tab") || "at_a_glance";
          renderDetailPage(route.id);
          return;
        }
        var copyBtn = e.target.closest(".copy-btn");
        if (copyBtn) {
          var parent = copyBtn.parentElement;
          if (!parent) return;
          var text = parent.textContent ? parent.textContent.replace("⧉", "").trim() : "";
          if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
              status("Copied.", "ok");
            }).catch(function() {});
          }
        }
      });
    }

    function renderRoute() {
      var route = getRouteInfo();
      if (route.view === "new") {
        renderNewPageLayout();
        void Promise.all([loadModelConfig(), loadCandidates()]);
        return;
      }
      if (route.view === "detail") {
        if (!route.id) {
          renderRoot('<div class="empty">Invalid report id.</div>');
          return;
        }
        renderDetailPage(route.id);
        return;
      }
      renderListPage();
    }

    wireGlobalEvents();
    loadSidebarSessions().then(function() {
      renderRoute();
    });
`;
