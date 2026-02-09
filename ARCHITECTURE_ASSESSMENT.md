# Architecture Assessment & Refactoring Plan

## Current Status
✅ **Code builds and works correctly**
✅ **14 TypeScript files, 7,783 total lines**
❌ **3 files exceed 300-line requirement**

## Files Requiring Refactoring

### 1. `/src/web/server.ts` (4,673 lines) ⚠️ CRITICAL
**Current Structure:**
- Lines 8-713: `getSearchPage()` - HTML page with embedded CSS/JS
- Lines 714-928: `getSessionPage()` - HTML page
- Lines 929-1512: `getInsightsPage()` - HTML page
- Lines 1513-2309: `getSettingsPage()` - HTML page
- Lines 2310-3821: `getInsightsReportsPage()` - HTML page
- Lines 3822-4013: Utility functions (parsing, JSON helpers)
- Lines 4014-4666: Request handler with all API routes
- Lines 4667-4673: Server startup

**Refactoring Strategy:**
1. **Extract 5 view modules** (lines 8-3821 → 5 files ~300-800 lines each)
   - `views/search.ts` - Search page template
   - `views/session.ts` - Session detail page
   - `views/insights.ts` - Insights page
   - `views/settings.ts` - Settings page
   - `views/insights-reports.ts` - Reports page

2. **Extract utilities** (lines 3822-4013 → `utils/http.ts` ~200 lines)
   - Query parsing, JSON utilities, HTTP helpers

3. **Extract API routes** (lines 4014-4666 → `api/routes.ts` ~650 lines)
   - All route handlers in one file

4. **New minimal server.ts** (~10 lines)
   - Import and export from routes
   - Entry point only

**Risk:** LOW - Views are standalone functions, easy to extract

---

### 2. `/src/storage/db.ts` (1,032 lines) ⚠️ HIGH PRIORITY
**Current Structure:**
- Lines 1-110: Database initialization & migrations
- Lines 119-153: Session upsert/insert operations
- Lines 154-230: Message search & list operations
- Lines 231-394: Session listing & filtering (complex queries)
- Lines 395-522: Session details & aggregates
- Lines 523-833: Insight report operations
- Lines 834-1032: Settings & configuration

**60 exported functions/types** - Heavy coupling risk!

**Refactoring Strategy:**
1. **Keep shared code** → `db-core.ts` (~150 lines)
   - Database initialization
   - `getDb()`, `closeDb()`, type definitions
   - Migration runner

2. **Split by domain**:
   - `queries/sessions.ts` (~250 lines) - Session CRUD & queries
   - `queries/messages.ts` (~200 lines) - Message operations & search
   - `queries/insights.ts` (~300 lines) - Insight report operations
   - `queries/settings.ts` (~150 lines) - Settings & source config

3. **Re-export barrel** → `db.ts` (~10 lines)
   ```ts
   export * from "./db-core.js";
   export * from "./queries/sessions.js";
   export * from "./queries/messages.js";
   export * from "./queries/insights.js";
   export * from "./queries/settings.js";
   ```

**Risk:** MEDIUM - Many imports across codebase need barrel export pattern

---

### 3. `/src/insights/generate.ts` (901 lines) ⚠️ MEDIUM PRIORITY
**Current Structure:**
- Lines 1-108: Type definitions & interfaces
- Lines 109-865: Local analysis logic (data processing, keyword matching)
- Lines 866-901: Main `generateInsight()` function (LLM orchestration)

**Refactoring Strategy:**
1. **Types module** → `types.ts` (~110 lines)
   - All interfaces and type definitions

2. **Analysis module** → `analysis/processor.ts` (~270 lines)
   - Local data analysis
   - Keyword matching logic
   - Statistical calculations

3. **LLM client** → `llm/client.ts` (~250 lines)
   - LLM API calls
   - Prompt construction
   - Response parsing

4. **Main orchestrator** → `generate.ts` (~280 lines)
   - `generateInsight()` main function
   - Coordinate analysis + LLM
   - Re-export types

**Risk:** LOW - Clear separation of concerns, minimal external dependencies

---

## Refactoring Execution Plan

### Phase 1: Web Server Split (Lowest Risk)
1. Create `src/web/views/` directory
2. Extract 5 view functions to separate files
3. Create `src/web/utils/http.ts` with utilities
4. Create `src/web/api/routes.ts` with route handler
5. Replace `server.ts` with minimal entry point
6. **Validation:** Run `npm run typecheck && npm run build`

### Phase 2: Insights Split (Medium Risk)
1. Create `src/insights/types.ts`
2. Create `src/insights/analysis/processor.ts`
3. Create `src/insights/llm/client.ts`
4. Update `generate.ts` to re-export
5. **Validation:** Run `npm run typecheck && npm run build`

### Phase 3: Database Split (Highest Risk)
1. Create `src/storage/db-core.ts`
2. Create `src/storage/queries/` subdirectories
3. Split into 4 query modules
4. Update `db.ts` to barrel export all
5. **Validation:** Run `npm run typecheck && npm run build`
6. **Critical:** Verify all imports resolve through barrel

---

## Expected Outcome

### Before:
- 3 files over 300 lines (4,673 + 1,032 + 901 = 6,606 lines)
- Monolithic structure

### After:
- **~25 files**, all under 300 lines
- Largest file: ~300 lines
- Modular, testable architecture

### File Count Estimate:
- Web layer: 5 views + 1 utils + 1 routes + 1 entry = **8 files**
- Insights: 1 types + 1 processor + 1 client + 1 main = **4 files**
- Storage: 1 core + 4 queries + 1 barrel = **6 files**
- Existing: 11 files (ingest, cli, etc.)
- **Total: ~29 files**

---

## Testing Strategy
After each phase:
1. ✅ `npm run typecheck` - No TypeScript errors
2. ✅ `npm run build` - Successful compilation
3. ✅ Manual smoke test - Start server, verify pages load
4. ✅ Git commit - Checkpoint for rollback

---

## Questions for Confirmation

1. **Proceed with this 3-phase plan?** (Phase 1 → 2 → 3)
2. **View files**: Keep as-is (~800 lines with HTML/CSS/JS) or split further?
3. **Database barrel export**: OK to use `export *` pattern for backward compatibility?
4. **Commit after each phase** for safety?
