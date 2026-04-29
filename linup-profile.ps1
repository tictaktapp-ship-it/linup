# VS Build Tools environment
$devCmd = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $devCmd) {
    $envVars = cmd /c "`"$devCmd`" 2>nul && set" | Where-Object { $_ -match '=' }
    foreach ($var in $envVars) {
        $parts = $var -split '=', 2
        if ($parts.Count -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
        }
    }
}

function Write-LF {
    param([string]$Path, [string]$Content)
    $abs = Join-Path "E:\linup-io" $Path
    $dir = Split-Path $abs -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $content = $Content -replace "`r`n", "`n" -replace "`r", "`n"
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($abs, $content, $utf8)
}

function Add-LineIfMissing {
    param([string]$Path, [string]$Line)
    $abs = Join-Path "E:\linup-io" $Path
    $current = if (Test-Path $abs) { [System.IO.File]::ReadAllText($abs) -replace "`r","" } else { "" }
    if ($current -notmatch [regex]::Escape($Line.Trim())) {
        $new = $current.TrimEnd() + "`n" + $Line.Trim() + "`n"
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($abs, $new, $utf8)
        Write-Host "  + Added: $Line" -ForegroundColor Green
    } else {
        Write-Host "  = Already present: $Line" -ForegroundColor DarkGray
    }
}

function Add-TauriCommand {
    param([string]$Command)
    $abs = "E:\linup-io\src-tauri\src\lib.rs"
    $content = [System.IO.File]::ReadAllText($abs) -replace "`r",""
    $trimmed = $Command.Trim().TrimEnd(',')
    if ($content -notmatch [regex]::Escape($trimmed)) {
        $content = $content -replace '(tauri::generate_handler!\[)', "`$1`n            $trimmed,"
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($abs, $content, $utf8)
        Write-Host "  + Registered: $trimmed" -ForegroundColor Green
    } else {
        Write-Host "  = Already registered: $trimmed" -ForegroundColor DarkGray
    }
}

function Add-Migration {
    param([int]$Version, [string]$Description, [string]$SqlFile)
    $abs = "E:\linup-io\src-tauri\src\lib.rs"
    $content = [System.IO.File]::ReadAllText($abs) -replace "`r",""
    $marker = "description: `"$Description`""
    if ($content -notmatch [regex]::Escape($marker)) {
        $migBlock = "                    tauri_plugin_sql::Migration {`n                        version: $Version,`n                        description: `"$Description`",`n                        sql: include_str!(`"../migrations/$SqlFile`"),`n                        kind: tauri_plugin_sql::MigrationKind::Up,`n                    },"
        $content = $content -replace '(\s*\]\s*\)\s*\.build\(\))', "`n$migBlock`$1"
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($abs, $content, $utf8)
        Write-Host "  + Added migration v$Version`: $Description" -ForegroundColor Green
    } else {
        Write-Host "  = Migration already present: $Description" -ForegroundColor DarkGray
    }
}

function Add-CrateDep {
    param([string]$Line)
    $abs = "E:\linup-io\src-tauri\Cargo.toml"
    $content = [System.IO.File]::ReadAllText($abs) -replace "`r",""
    $crate = ($Line -split '=')[0].Trim()
    if ($content -notmatch "(?m)^$([regex]::Escape($crate))\s*=") {
        $content = $content -replace '(\[dependencies\])', "`$1`n$Line"
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($abs, $content, $utf8)
        Write-Host "  + Added crate: $crate" -ForegroundColor Green
    } else {
        Write-Host "  = Already present: $crate" -ForegroundColor DarkGray
    }
}

function Get-CodeBlock {
    param([string]$Output, [string]$Language)
    # 1. Exact match
    $m = [regex]::Match($Output, "(?s)``````$Language\s*\r?\n(.*?)\r?\n\s*``````")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    # 2. Language with trailing chars (e.g. ```rust // comment)
    $m = [regex]::Match($Output, "(?s)``````\s*$Language[^\n]*\r?\n(.*?)\r?\n\s*``````")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    # 3. Any fenced block - pick by language signature
    $all = [regex]::Matches($Output, "(?s)``````[^\n]*\r?\n(.*?)\r?\n\s*``````")
    foreach ($blk in $all) {
        $body = $blk.Groups[1].Value.Trim()
        $hit = switch ($Language) {
            "rust"       { $body -match "fn |use |pub |impl |struct |enum " }
            "sql"        { $body -match "CREATE TABLE|ALTER TABLE|INSERT INTO" }
            "typescript" { $body -match "^import |^export |^interface |^type |^const " }
            "tsx"        { $body -match "React|return \(|<div|useState|useEffect" }
            "yaml"       { $body -match "^name:|^on:|^jobs:" }
            "bash"       { $body -match "#!/|xcrun|notarytool" }
            "powershell" { $body -match "param\(|Write-Host|signtool" }
            default      { $false }
        }
        if ($hit) { return $body }
    }
    # 4. No fences at all - scan for language signature in raw output
    $lines = $Output -split "`n"
    $start = -1; $end = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $sig = switch ($Language) {
            "rust"       { $lines[$i] -match "^use |^pub |^fn |^#\[|^struct |^impl " }
            "sql"        { $lines[$i] -match "^CREATE TABLE|^ALTER TABLE" }
            "typescript" { $lines[$i] -match "^import |^export |^interface |^const " }
            "tsx"        { $lines[$i] -match "^import React|^const.*React\.FC" }
            default      { $false }
        }
        if ($sig -and $start -eq -1) { $start = $i }
        if ($start -ge 0 -and $lines[$i] -match "^\s*$" -and $i -gt $start + 5) { $end = $i; break }
    }
    if ($start -ge 0) {
        $endIdx = if ($end -gt 0) { $end } else { $lines.Count - 1 }
        return ($lines[$start..$endIdx] -join "`n").Trim()
    }
    return $null
}

function Assert-FileExists {
    param([string]$RelPath, [string]$Feature)
    $abs = Join-Path "E:\linup-io" $RelPath
    if (-not (Test-Path $abs)) {
        Write-Host "  MISSING: $RelPath was not saved for $Feature - check output and save manually" -ForegroundColor Red
        return $false
    }
    return $true
}

$rustDb = "CRITICAL RUST DB PATTERN - follow exactly:" +
    "`n- Use rusqlite crate directly (NOT tauri-plugin-sql, NOT sqlx, NOT DbPool, NOT State)" +
    "`n- tauri-plugin-sql is JavaScript-only. Cannot be used from Rust commands." +
    "`n- Always add: use tauri::Emitter; when using app.emit()" +
    "`n- Open DB pattern:" +
    "`n`nuse rusqlite::{Connection, params};" +
    "`nuse tauri::Emitter;" +
    "`nconst DB_PATH: &str = `"E:\\\\linup-io\\\\linup.db`";" +
    "`nfn open_db() -> Result<Connection, String> { Connection::open(DB_PATH).map_err(|e| format!(``DB error: {e}``)) }" +
    "`n`n- Commands are synchronous (pub fn) unless calling reqwest (then pub async fn)" +
    "`n- Use params![] for all query parameters" +
    "`n- UUIDs: format!(`"{}`", uuid::Uuid::new_v4())" +
    "`n- All structs: #[derive(Debug, Serialize, Deserialize)]" +
    "`n- Do NOT use sqlx, DbPool, or State for DB access"

$tsRules = "CRITICAL TYPESCRIPT RULES - follow exactly:" +
    "`n- Use import type for all type-only imports (verbatimModuleSyntax is enabled)" +
    "`n- Never use import { Foo } for types - always import type { Foo }" +
    "`n- Never declare variables that are unused" +
    "`n- Return type inference is fine, no need to annotate every function"

$mecContext = "MEC RULES - embed in every generated app:" +
    "`n- Scaffold (F-015) injects MEC SDK: @linup/mec-sdk" +
    "`n- mec.can(featureKey), mec.track(event, metadata), mec.billing.reportRevenue(amount, currency, intentId)" +
    "`n- Inject revenue_events + entitlement_checks tables into generated app migrations" +
    "`n- LINUP takes 1.5% gross revenue via Stripe Connect. Zero if app earns zero." +
    "`n- MEC must pass Stage 8 hardening gates" +
    "`n- Disclose in generated app README and onboarding Step 4"

$featureConfig = @{
    "F-003" = @{ RustFile="src-tauri\src\commands\stage.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod stage;"; Commands=@("commands::stage::get_stage_model","commands::stage::set_stage_approved","commands::stage::set_stage_status"); SqlFile=$null; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-070" = @{ RustFile="src-tauri\src\commands\artifacts.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod artifacts;"; Commands=@("commands::artifacts::write_artifact","commands::artifacts::get_artifacts","commands::artifacts::read_artifact","commands::artifacts::verify_artifact","commands::artifacts::assemble_evidence_pack"); SqlFile="src-tauri\migrations\003_artifacts.sql"; SqlVersion=3; SqlDesc="create_artifacts"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-040" = @{ RustFile="src-tauri\src\commands\budget.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod budget;"; Commands=@("commands::budget::check_budget","commands::budget::raise_cap"); SqlFile="src-tauri\migrations\002_budget_columns.sql"; SqlVersion=2; SqlDesc="budget_columns"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-041" = @{ RustFile="src-tauri\src\commands\stop_condition.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod stop_condition;"; Commands=@("commands::stop_condition::check_stop_conditions","commands::stop_condition::record_stop_event","commands::stop_condition::resolve_stop_event","commands::stop_condition::export_patch","commands::stop_condition::rollback_to_snapshot"); SqlFile="src-tauri\migrations\004_stop_events.sql"; SqlVersion=4; SqlDesc="create_stop_events"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-050" = @{ RustFile="src-tauri\src\commands\system.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod system;"; Commands=@("commands::system::get_connectivity_status"); SqlFile=$null; TsFiles=@("src\stores\connectivity.ts","src\components\OfflineBanner.tsx"); ExtraCrates=@() }
    "F-031" = @{ RustFile=$null; TsFiles=@("src\components\StageStatusHeader.tsx") }
    "F-032" = @{ RustFile=$null; TsFiles=@("src\components\EvidencePackViewer.tsx") }
    "F-033" = @{ RustFile=$null; TsFiles=@("src\components\BudgetBar.tsx") }
    "F-071" = @{ RustFile=$null; TsFiles=@("src\types\diff.ts","src\components\DiffViewer.tsx") }
    "F-001" = @{ RustFile=$null; TsFiles=@("src\screens\ProjectsScreen.tsx","src\types\project.ts") }
    "F-030" = @{ RustFile=$null; TsFiles=@("src\screens\StageWorkspaceScreen.tsx") }
    "F-002" = @{ RustFile=$null; TsFiles=@("src\screens\onboarding\Step1.tsx","src\screens\onboarding\Step2.tsx","src\screens\onboarding\Step3.tsx","src\screens\onboarding\Step4.tsx","src\screens\onboarding\Step5.tsx","src\screens\onboarding\Step6.tsx","src\screens\OnboardingFlow.tsx") }
    "F-010" = @{ RustFile="src-tauri\src\commands\pipeline\stage1_idea_intake.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage1_idea_intake;"; ParentMod=$true; Commands=@("commands::pipeline::stage1_idea_intake::save_idea_intake","commands::pipeline::stage1_idea_intake::get_idea_intake","commands::pipeline::stage1_idea_intake::submit_idea_intake"); SqlFile="src-tauri\migrations\004_idea_intake.sql"; SqlVersion=4; SqlDesc="create_idea_intake"; ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }'); TsFiles=@("src\screens\pipeline\Stage1IdeaIntake.tsx") }
    "F-011" = @{ RustFile="src-tauri\src\commands\pipeline\stage2_clarify.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage2_clarify;"; Commands=@("commands::pipeline::stage2_clarify::start_clarify","commands::pipeline::stage2_clarify::save_clarify_answers","commands::pipeline::stage2_clarify::approve_clarify"); SqlFile="src-tauri\migrations\005_clarify_sessions.sql"; SqlVersion=5; SqlDesc="create_clarify_sessions"; ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }'); TsFiles=@("src\screens\pipeline\Stage2Clarify.tsx") }
    "F-013" = @{ RustFile="src-tauri\src\commands\pipeline\stage4_product_spec.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage4_product_spec;"; ParentMod=$true; Commands=@("commands::pipeline::stage4_product_spec::run_stage_product_spec"); SqlFile=$null; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-014" = @{ RustFile="src-tauri\src\commands\pipeline\stage5_architecture.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage5_architecture;"; Commands=@("commands::pipeline::stage5_architecture::run_stage_architecture"); SqlFile=$null; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-015" = @{ RustFile="src-tauri\src\commands\pipeline\stage6_scaffold.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage6_scaffold;"; Commands=@("commands::pipeline::stage6_scaffold::scaffold_project","commands::pipeline::stage6_scaffold::get_scaffold_status","commands::pipeline::stage6_scaffold::open_project_folder"); SqlFile=$null; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-016" = @{ RustFile="src-tauri\src\commands\pipeline\stage7_implementation.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage7_implementation;"; Commands=@("commands::pipeline::stage7_implementation::run_implementation_batch","commands::pipeline::stage7_implementation::get_implementation_batches"); SqlFile="src-tauri\migrations\005_implementation_batches.sql"; SqlVersion=5; SqlDesc="create_implementation_batches"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-017" = @{ RustFile="src-tauri\src\commands\pipeline\stage8_hardening.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage8_hardening;"; Commands=@("commands::pipeline::stage8_hardening::run_stage_hardening"); SqlFile=$null; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-018" = @{ RustFile="src-tauri\src\commands\pipeline\stage9_tests.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage9_tests;"; Commands=@("commands::pipeline::stage9_tests::run_tests","commands::pipeline::stage9_tests::get_test_runs","commands::pipeline::stage9_tests::read_test_log"); SqlFile="src-tauri\migrations\006_test_runs.sql"; SqlVersion=6; SqlDesc="create_test_runs"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-019" = @{ RustFile="src-tauri\src\commands\pipeline\stage10_build.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage10_build;"; Commands=@("commands::pipeline::stage10_build::build_desktop","commands::pipeline::stage10_build::get_builds","commands::pipeline::stage10_build::open_build_output"); SqlFile="src-tauri\migrations\007_builds.sql"; SqlVersion=7; SqlDesc="create_builds"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-020" = @{ RustFile="src-tauri\src\commands\pipeline\stage11_deployment.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage11_deployment;"; Commands=@("commands::pipeline::stage11_deployment::deploy","commands::pipeline::stage11_deployment::get_deploys","commands::pipeline::stage11_deployment::rollback_deploy"); SqlFile="src-tauri\migrations\008_deployments.sql"; SqlVersion=8; SqlDesc="create_deployments"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-021" = @{ RustFile="src-tauri\src\commands\pipeline\stage12_export.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage12_export;"; Commands=@("commands::pipeline::stage12_export::create_export","commands::pipeline::stage12_export::validate_export","commands::pipeline::stage12_export::open_export_folder"); SqlFile="src-tauri\migrations\009_exports.sql"; SqlVersion=9; SqlDesc="create_exports"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-022" = @{ RustFile="src-tauri\src\commands\pipeline\stage13_release_notes.rs"; ModFile="src-tauri\src\commands\pipeline\mod.rs"; ModLine="pub mod stage13_release_notes;"; Commands=@("commands::pipeline::stage13_release_notes::generate_release_notes","commands::pipeline::stage13_release_notes::get_audit_trail","commands::pipeline::stage13_release_notes::export_audit_trail","commands::pipeline::stage13_release_notes::record_stage_approval"); SqlFile="src-tauri\migrations\010_audit_trail.sql"; SqlVersion=10; SqlDesc="create_audit_trail"; ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }','whoami = "1"'); TsFiles=@() }
    "F-080" = @{ RustFile=$null; TsFiles=@(); YamlFile=".github\workflows\release-macos.yml"; ShellFile="scripts\notarise-macos.sh" }
    "F-081" = @{ RustFile=$null; TsFiles=@(); YamlFile=".github\workflows\release-windows.yml"; Ps1File="scripts\sign-windows.ps1" }
    "F-082" = @{ RustFile="src-tauri\src\commands\updater.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod updater;"; Commands=@("commands::updater::check_for_update","commands::updater::get_current_version","commands::updater::get_update_channel","commands::updater::set_update_channel","commands::updater::get_update_history"); SqlFile="src-tauri\migrations\011_update_history.sql"; SqlVersion=11; SqlDesc="create_update_history"; ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }'); TsFiles=@("src\screens\UpdatesScreen.tsx") }
    "F-062" = @{ RustFile="src-tauri\src\commands\preview.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod preview;"; Commands=@("commands::preview::start_preview_server","commands::preview::stop_preview_server","commands::preview::open_preview_window","commands::preview::get_preview_status"); SqlFile=$null; TsFiles=@("src\components\PreviewButton.tsx"); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
    "F-090" = @{ RustFile="src-tauri\src\commands\mec.rs"; ModFile="src-tauri\src\commands\mod.rs"; ModLine="pub mod mec;"; Commands=@("commands::mec::report_revenue","commands::mec::check_entitlement","commands::mec::get_mec_summary"); SqlFile="src-tauri\migrations\012_mec.sql"; SqlVersion=12; SqlDesc="create_mec_tables"; TsFiles=@(); ExtraCrates=@('rusqlite = { version = "0.31", features = ["bundled"] }') }
}

$prompts = @{}
$prompts["F-003"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/stage.rs. DB E:\\linup-io\\linup.db. Tables: projects(id TEXT PK, name TEXT, budget_cap REAL), stage_runs(id TEXT PK, project_id TEXT, stage_index INTEGER, status TEXT DEFAULT locked, started_at TEXT, locked_at TEXT, cost_usd REAL DEFAULT 0). Status values: locked|ready|running|awaiting_approval|gate_failed|budget_exceeded|stopped|complete.`n`nTASK: Output ONE rust code block containing: open_db() fn, StageRun struct (Serialize+Deserialize), StageModel struct (Serialize+Deserialize), get_stage_model(project_id: String)->Result<StageModel,String> creating 11 locked rows if none exist, set_stage_approved(project_id: String, stage_index: i64)->Result<(),String> errors if not awaiting_approval sets current->complete next->ready, set_stage_status(project_id: String, stage_index: i64, status: String)->Result<(),String> validates status. Output ONLY the rust block. No prose. No Cargo.toml."
$prompts["F-070"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/artifacts.rs. DB E:\\linup-io\\linup.db. sha2=0.10 hex=0.4 uuid v1 in Cargo.toml. Disk path: [project_folder]/.linup/artifacts/[run_id]/[filename]. Append-only.`n`nTASK: Output TWO blocks. 1) sql block: CREATE TABLE artifacts(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_index INTEGER NOT NULL, run_id TEXT NOT NULL, artifact_type TEXT NOT NULL, filename TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT local). 2) rust block: open_db(), ArtifactMeta struct, EvidencePack struct{what_changed,why,risk,gates_passed,gates_failed,artifacts,snapshot_name}, write_artifact(project_id,stage_index,run_id,artifact_type,filename,content:Vec<u8>)->Result<String,String> write disk+sha256+insert+return uuid, get_artifacts(project_id,stage_index)->Result<Vec<ArtifactMeta>,String>, read_artifact(artifact_id)->Result<Vec<u8>,String>, verify_artifact(artifact_id)->Result<bool,String>, assemble_evidence_pack(project_id,stage_index,run_id)->Result<EvidencePack,String>. Output ONLY the two blocks. No prose."
$prompts["F-040"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/budget.rs. DB E:\\linup-io\\linup.db. stage_runs owned by F-003 do NOT recreate. projects has budget_cap REAL. Emit budget:exceeded via app.emit() - always include use tauri::Emitter; at top of file.`n`nTASK: Output TWO blocks. 1) sql: ALTER TABLE stage_runs ADD COLUMN IF NOT EXISTS cost_tokens_in INTEGER NOT NULL DEFAULT 0; ALTER TABLE stage_runs ADD COLUMN IF NOT EXISTS cost_tokens_out INTEGER NOT NULL DEFAULT 0; 2) rust: open_db(), BudgetStatus{spent:f64,cap:f64,state:String}(Serialize+Deserialize), check_budget(app:tauri::AppHandle,project_id:String)->Result<BudgetStatus,String> sum cost_usd compare to budget_cap states Safe<80 Warning>=80 Critical>=95 Exceeded>=100 if Exceeded app.emit(budget:exceeded).ok(), raise_cap(project_id:String,new_cap:f64)->Result<(),String> validate new_cap>spent. Output ONLY two blocks. No prose."
$prompts["F-041"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/stop_condition.rs. DB E:\\linup-io\\linup.db. Triggers: >3 consecutive gate failures, budget Critical+>50% failure last 5, >2 distinct gate types failing. Emit stage:stopped.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE stop_events(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_index INTEGER NOT NULL, reason TEXT NOT NULL, triggered_at TEXT NOT NULL, resolved_at TEXT, resolution TEXT). 2) rust: open_db(), StopReason{reason:String,triggered_at:String}(Serialize+Deserialize), check_stop_conditions(project_id,stage_index)->Result<Option<StopReason>,String>, record_stop_event(app:tauri::AppHandle,project_id,stage_index,reason)->Result<String,String>, resolve_stop_event(project_id,stop_event_id,resolution)->Result<(),String>, export_patch(project_id,stage_index)->Result<String,String>, rollback_to_snapshot(project_id,stage_index)->Result<(),String>. Output ONLY two blocks. No prose."
$prompts["F-050"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: Rust src-tauri/src/commands/system.rs. TS src/stores/connectivity.ts and src/components/OfflineBanner.tsx. Network check HEAD to https://api.anthropic.com 3s timeout using reqwest. This IS async.`n`nTASK: Output THREE blocks. 1) rust: pub async fn get_connectivity_status()->Result<ConnectivityStatus,String> ConnectivityStatus{online:bool,last_checked_at:String}(Serialize+Deserialize). 2) typescript: connectivity store React context polls 30s exposes {isOnline,lastChecked}. 3) tsx: OfflineBanner props state:offline|reconnecting|reconnected auto-dismiss reconnected 3s. Output ONLY three blocks. No prose."
$prompts["F-031"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: File src/components/StageStatusHeader.tsx. CSS tokens in src/index.css. Plain React only.`nTASK: Output ONE tsx block with StageStatusHeader. Props: {stageName:string;stageIndex:number;stageTotal:number;state:running|awaiting_approval|gate_failed|budget_exceeded|stopped|complete;gatesPassed?:number;gatesFailed?:number;budgetSpent?:number;budgetCap?:number;onApprove?:()=>void;onRequestChanges?:()=>void;onStop?:()=>void;onChoosePath?:()=>void;onRaiseCap?:()=>void;onReduceScope?:()=>void;onViewEvidence?:()=>void;onRerun?:()=>void}. Six states: running(#1D4ED8+pulsing+Stop), awaiting_approval(#1D4ED8+Approve+Request changes), gate_failed(#DC2626+View failed+Retry), budget_exceeded(#7C3AED+Raise cap+Reduce scope+Stop), stopped(#7C3AED+Choose a path full-width), complete(#16A34A+View evidence+Re-run). Include StageStatusHeaderAllStates export. Output ONLY tsx block. No prose."
$prompts["F-032"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: File src/components/EvidencePackViewer.tsx. diff-added bg #DCFCE7 diff-removed bg #FEE2E2 JetBrains Mono. Summary always visible detail on toggle approval buttons only when awaiting_approval.`nTASK: Output ONE tsx block with EvidencePackViewer. Types: DiffLine{lineNum?:number;type:added|removed|context;content:string} Artifact{name:string;status:synced|not_synced} GateResult{name:string;passed:boolean;description:string}. Props: {stageNumber:number;stageName:string;whatChanged:string;why:string;risk:low|medium|high;gatesPassed:number;gatesFailed:number;snapshotName:string;diff?:DiffLine[];artifacts?:Artifact[];gateResults?:GateResult[];stageState:awaiting_approval|complete|gate_failed|running;onApprove?:()=>void;onRequestChanges?:()=>void;onRollBack?:()=>void;defaultExpanded?:boolean}. Output ONLY tsx block. No prose."
$prompts["F-033"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: File src/components/BudgetBar.tsx. No external libs. States from ratio: safe<80(#16A34A) warning>=80(#D97706) critical>=95(#DC2626) exceeded(#7C3AED).`nTASK: Output ONE tsx block with BudgetBar and BudgetBreakdownDrawer in same file. BudgetBarProps:{spent:number;cap:number;width?:string;showViewSpend?:boolean;stageBreakdown?:{stageName:string;spent:number}[]}. 10px bar GBP amounts monospace View spend opens 320px right drawer. Output ONLY tsx block. No prose."
$prompts["F-071"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nTASK: Output TWO blocks. 1) typescript for src/types/diff.ts: DiffLine{lineNum?:number;type:added|removed|context;content:string} DiffHunk{header:string;lines:DiffLine[]} DiffFile{path:string;hunks:DiffHunk[]}. 2) tsx for src/components/DiffViewer.tsx: props{files:DiffFile[];defaultFile?:string} left panel file list icons right panel diff JetBrains Mono line numbers #DCFCE7/#FEE2E2 DiffViewerDemo export at bottom. Output ONLY two blocks. No prose."
$prompts["F-001"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: invoke from @tauri-apps/api/core. CSS tokens in src/index.css. get_projects()->Project[]. Project:{id:string,name:string,lastStage:string,lastStageState:string,budgetUsed:number,budgetCap:number,lastSynced:string}.`nTASK: Output TWO blocks. 1) typescript for src/types/project.ts with Project type and StageState union. 2) tsx for src/screens/ProjectsScreen.tsx: empty state(centred card+CTA) has-projects(2-col grid) offline(banner+disabled button). Output ONLY two blocks. No prose."
$prompts["F-030"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: File src/screens/StageWorkspaceScreen.tsx. Route /project/:projectId/stage/:stageIndex. Imports StageStatusHeader EvidencePackViewer BudgetBar.`nTASK: Output ONE tsx block for StageWorkspaceScreen supporting states: ready_to_run running awaiting_approval gate_failed budget_exceeded stopped complete offline_readonly. Output ONLY tsx block. No prose."
$prompts["F-002"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 + React/TypeScript Vite desktop app.`nCONTEXT: src/screens/onboarding/Step1-6.tsx and src/screens/OnboardingFlow.tsx. React Context for state. invoke from @tauri-apps/api/core.`nTASK: Output SEVEN tsx blocks in order Step1 through Step6 then OnboardingFlow. Steps: Welcome, Create App(name+description+stack+folder), Set Caps(GBP), Connect Provider(Anthropic key), Run First Stage(ready), First Approval Gate(awaiting_approval+evidence pack). OnboardingFlow: Step N of 6 progress context state back/forward nav. Output ONLY seven tsx blocks. No prose."
$prompts["F-013"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage4_product_spec.rs. DB E:\\linup-io\\linup.db. Anthropic key from keyring v3 Entry::new(linup-io,anthropic).get_password(). POST https://api.anthropic.com/v1/messages x-api-key+anthropic-version:2023-06-01 model:claude-sonnet-4-20250514. THIS IS async. Stage index 3. Emit stage:progress and stage:complete via app.emit().`n`nTASK: Output ONE rust block for run_stage_product_spec(app:tauri::AppHandle,project_id:String)->Result<StageResult,String>. StageResult:{stage_index:i64,status:String,artifact_ids:Vec<String>,gates_passed:i64,gates_failed:i64}(Serialize+Deserialize). Steps: get key keyring, load idea_intake+clarify from DB, call Anthropic PE role product spec, write to artifacts table rusqlite, gate check user stories+acceptance criteria+technical constraints, update stage_runs awaiting_approval, emit events. Output ONLY rust block. No prose."
$prompts["F-014"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage5_architecture.rs. DB E:\\linup-io\\linup.db. Same Anthropic async pattern as F-013. Stage index 4. Load approved product_spec artifact write architecture artifact.`n`nTASK: Output ONE rust block for run_stage_architecture(app:tauri::AppHandle,project_id:String)->Result<StageResult,String>. System prompt: architecture doc with data model API surfaces auth boundaries threat model deployment plan. Gate check data model+auth+deployment. Update stage awaiting_approval. IMPORTANT: Also write a secrets.manifest.json artifact listing every external service the app needs with fields: key, label, description, provider, setup_url(use https://linup.io/setup/[provider]/[topic]), required(bool), validation(one of: stripe_api_check|openai_api_check|supabase_url_check|starts_with:[prefix]|non_empty|regex:[pattern]), when(before_deploy|before_run), group(core|ai|payments|communications|monitoring|app_specific). Output ONLY rust block. No prose."
$prompts["F-015"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`n$mecContext`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage6_scaffold.rs. DB E:\\linup-io\\linup.db. Creates files in user project folder from projects.folder_path. SAFE shell-out std::process::Command Vec<String> args ONLY. Next.js+Supabase stack.`n`nTASK: Output ONE rust block with: open_db(), scaffold_project(app:tauri::AppHandle,project_id:String)->Result<ScaffoldResult,String> ScaffoldResult:{files_created:Vec<String>,artifact_id:String} create package.json(include @linup/mec-sdk in dependencies)+src/app/page.tsx+src/lib/supabase.ts+src/lib/mec.ts(MecProvider wrapper)+.env.example(include LINUP_APP_ID)+supabase/migrations/001_core.sql(include revenue_events and entitlement_checks tables)+.gitignore write scaffold_summary artifact update stage awaiting_approval, get_scaffold_status(project_id)->Result<String,String>, open_project_folder(project_id)->Result<(),String> using explorer. Output ONLY rust block. No prose."
$prompts["F-016"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage7_implementation.rs. DB E:\\linup-io\\linup.db. Diff-first 5-file limit. THIS IS async. Model claude-haiku-4-5-20251001. Regression: cargo clippy+npx tsc --noEmit via Command.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE implementation_batches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,batch_index INTEGER NOT NULL,files_touched TEXT,status TEXT NOT NULL,artifact_id TEXT,gate_results TEXT,created_at TEXT NOT NULL). 2) rust async: run_implementation_batch(app:tauri::AppHandle,project_id:String,feature_description:String)->Result<BatchResult,String> BatchResult:{batch_index:i64,files_changed:Vec<String>,diff_artifact_id:String,gates_passed:bool} call Anthropic haiku unified diff max 5 files write artifact run gates store batch, get_implementation_batches(project_id)->Result<Vec<BatchSummary>,String>. Output ONLY two blocks. No prose."
$prompts["F-017"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage8_hardening.rs. DB E:\\linup-io\\linup.db. Safe shell-out std::process::Command Vec<String> only. Allowlist: cargo clippy cargo test npx eslint npm audit. Reject others. THIS IS async calls Anthropic.`n`nTASK: Output ONE rust block for run_stage_hardening(app:tauri::AppHandle,project_id:String)->Result<StageResult,String>. Run 4 gates via Command write gate_report artifacts call Anthropic security summary HARD fail(clippy errors/npm critical)->gate_failed else awaiting_approval. Gate check MUST include: MEC SDK present in package.json, revenue_events table in migrations, entitlement_checks table in migrations. Output ONLY rust block. No prose."
$prompts["F-018"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage9_tests.rs. DB E:\\linup-io\\linup.db. Read test command from package.json scripts.test at runtime NEVER hardcode. Missing->Err(No test script in package.json).`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE test_runs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,started_at TEXT,finished_at TEXT,exit_code INTEGER,passed INTEGER,failed INTEGER,artifact_id TEXT). 2) rust: run_tests(app:tauri::AppHandle,project_id:String)->Result<TestSummary,String> async TestSummary:{exit_code:i32,passed:i64,failed:i64,artifact_id:String} parse package.json run Command parse X passed/X failed write artifact insert test_run, get_test_runs(project_id)->Result<Vec<TestRunSummary>,String>, read_test_log(artifact_id)->Result<String,String>. Output ONLY two blocks. No prose."
$prompts["F-019"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage10_build.rs. DB E:\\linup-io\\linup.db. Build: pnpm tauri build -- --debug or pnpm tauri build. No signing.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE builds(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,mode TEXT NOT NULL,platform TEXT NOT NULL,started_at TEXT,finished_at TEXT,status TEXT NOT NULL,artifact_id TEXT). 2) rust: build_desktop(app:tauri::AppHandle,project_id:String,mode:String)->Result<BuildResult,String> BuildResult:{build_id:String,platform:String,mode:String,artifact_id:String,output_path:String}, get_builds(project_id)->Result<Vec<BuildSummary>,String>, open_build_output(project_id,build_id)->Result<(),String>. Output ONLY two blocks. No prose."
$prompts["F-020"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage11_deployment.rs. DB E:\\linup-io\\linup.db. Vercel CLI. Read .vercel/project.json. production requires confirmed:true.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE deployments(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,target TEXT NOT NULL,env TEXT,status TEXT NOT NULL,started_at TEXT,finished_at TEXT,url TEXT,artifact_id TEXT). 2) rust: deploy(app:tauri::AppHandle,project_id:String,target:String,confirmed:bool)->Result<DeployResult,String> DeployResult:{deploy_id:String,url:String,artifact_id:String} production+!confirmed->Err check .vercel/project.json run vercel extract url, get_deploys(project_id)->Result<Vec<DeploySummary>,String>, rollback_deploy(project_id,target,to_version)->Result<(),String> stub. Output ONLY two blocks. No prose."
$prompts["F-021"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage12_export.rs. DB E:\\linup-io\\linup.db. Export to [project_folder]/.linup/exports/[timestamp]/ exclude node_modules/.git/target/.env. Portability: copy to TEMP\\linup-portability-test\\[project_id]\\ run pnpm install+pnpm run build.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE exports(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,export_path TEXT NOT NULL,created_at TEXT NOT NULL,validation_status TEXT,validation_time_ms INTEGER). 2) rust: create_export(app:tauri::AppHandle,project_id:String)->Result<ExportResult,String> ExportResult:{export_id:String,export_path:String,files_included:Vec<String>}, validate_export(project_id,export_id)->Result<ValidationResult,String> ValidationResult:{passed:bool,elapsed_ms:u64,error:Option<String>}, open_export_folder(project_id,export_id)->Result<(),String>. Output ONLY two blocks. No prose."
$prompts["F-022"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/pipeline/stage13_release_notes.rs. DB E:\\linup-io\\linup.db. Final stage. Anthropic async. whoami crate for username. Audit entries append-only.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE audit_trail(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,stage_index INTEGER NOT NULL,approved_by TEXT NOT NULL,approved_at TEXT NOT NULL,artifact_ids TEXT,gate_summary TEXT,snapshot_name TEXT). 2) rust: generate_release_notes(app:tauri::AppHandle,project_id:String)->Result<ReleaseNotesResult,String> async call Anthropic write artifact update stage complete emit stage:complete, get_audit_trail(project_id)->Result<Vec<AuditEntry>,String>, export_audit_trail(project_id)->Result<String,String>, record_stage_approval(project_id,stage_index:i64,artifact_ids:Vec<String>,gate_summary:String)->Result<(),String> use whoami::username(). Output ONLY two blocks. No prose."
$prompts["F-080"] = "Setting up macOS distribution for LINUP.IO Tauri v2. Runs on macOS CI only.`nTASK: Output TWO blocks. 1) yaml for .github/workflows/release-macos.yml: trigger push release/* or workflow_dispatch, macos-latest, checkout+node 24+pnpm v4+pnpm install+rust stable+import p12 cert+cargo tauri build --release+run notarise-macos.sh+upload dmg. 2) bash for scripts/notarise-macos.sh: submit xcrun notarytool poll 30s staple Accepted exit 1 failure. Secrets: APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_ID APPLE_ID_PASSWORD APPLE_TEAM_ID. Output ONLY two blocks. No prose."
$prompts["F-081"] = "Setting up Windows distribution for LINUP.IO Tauri v2.`nTASK: Output TWO blocks. 1) yaml for .github/workflows/release-windows.yml: trigger push release/* or workflow_dispatch, windows-latest, checkout+node 24+pnpm v4+pnpm install+rust+rust-cache+CARGO_HTTP_CHECK_REVOKE=false+cargo tauri build --release+sign+upload msi. 2) powershell for scripts/sign-windows.ps1: import cert base64 env signtool sign RFC3161 verify PASS/FAIL cleanup. Secrets: WINDOWS_CERTIFICATE WINDOWS_CERTIFICATE_PASSWORD. Output ONLY two blocks. No prose."
$prompts["F-082"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: Rust src-tauri/src/commands/updater.rs TS src/screens/UpdatesScreen.tsx. DB E:\\linup-io\\linup.db. Three channels: canary beta stable.`n`nTASK: Output THREE blocks. 1) sql: CREATE TABLE update_history(id TEXT PRIMARY KEY,version TEXT NOT NULL,channel TEXT NOT NULL,applied_at TEXT NOT NULL,status TEXT NOT NULL). 2) rust: open_db() check_for_update get_current_version get_update_channel set_update_channel get_update_history. 3) tsx for src/screens/UpdatesScreen.tsx: version display channel selector check now button history list. Output ONLY three blocks. No prose."
$prompts["F-062"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: File src-tauri/src/commands/preview.rs. Preview window shows the user their app running locally during awaiting_approval state. Spawns next dev as child process, opens Tauri WebviewWindow pointing at localhost:3000. Must clean up child process on stop.`n`nTASK: Output TWO blocks.`n1) rust with open_db() +:`n   - PreviewStatus{project_id:String,url:String,port:u16,status:String}(Serialize+Deserialize)`n   - start_preview_server(app:tauri::AppHandle,project_id:String)->Result<PreviewStatus,String> gets folder_path from DB, spawns Command::new(pnpm).args([dev]).current_dir(folder_path) stores child PID in a static Mutex<HashMap<String,u32>>, polls port 3000 up to 30s, returns PreviewStatus{url:http://localhost:3000}`n   - stop_preview_server(project_id:String)->Result<(),String> kills child process by PID from static map`n   - open_preview_window(app:tauri::AppHandle,url:String)->Result<(),String> opens tauri::WebviewWindowBuilder::new with label=preview title=App preview inner_size 1280x800`n   - get_preview_status(project_id:String)->Result<PreviewStatus,String> checks if process still running`n2) tsx for src/components/PreviewButton.tsx:`n   - Props: {projectId:string, stageState:string}`n   - Only renders when stageState===awaiting_approval or stageState===complete`n   - Button: Preview app -> calls start_preview_server then open_preview_window`n   - Shows loading state while server starts (up to 30s with spinner)`n   - Shows Stop preview button when running`n   - Error state if server fails to start`n   - use import type for type imports`n`nOutput ONLY two blocks. No prose."

$prompts["F-090"] = "I'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`n$mecContext`n`nCONTEXT: File src-tauri/src/commands/mec.rs. DB E:\\linup-io\\linup.db. LINUP platform MEC command layer - tracks 1.5% revenue share for the LINUP control plane. Zero if app earns zero.`n`nTASK: Output TWO blocks. 1) sql: CREATE TABLE mec_revenue_events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,app_id TEXT NOT NULL,gross_amount_pence INTEGER NOT NULL,mec_share_pence INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT gbp,stripe_payment_intent_id TEXT,status TEXT NOT NULL DEFAULT pending,created_at TEXT NOT NULL); CREATE TABLE mec_entitlement_log(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,feature_key TEXT NOT NULL,result TEXT NOT NULL,plan TEXT NOT NULL,checked_at TEXT NOT NULL). 2) rust: open_db() + report_revenue(project_id:String,app_id:String,gross_amount_pence:i64,currency:String,stripe_payment_intent_id:Option<String>)->Result<String,String> mec_share_pence=(gross_amount_pence*15/1000) INSERT mec_revenue_events return id, check_entitlement(project_id:String,feature_key:String,plan:String)->Result<bool,String> logs to mec_entitlement_log, get_mec_summary(project_id:String)->Result<MecSummary,String> MecSummary{total_gross_pence:i64,total_share_pence:i64,share_rate:f64,event_count:i64}(Serialize+Deserialize). Output ONLY two blocks. No prose."
$prompts["F-010"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: Rust src-tauri/src/commands/pipeline/stage1_idea_intake.rs. DB E:\\linup-io\\linup.db.`n`nTASK: Output THREE blocks. 1) sql: CREATE TABLE idea_intake(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,title TEXT NOT NULL,problem_statement TEXT NOT NULL,target_user TEXT NOT NULL,constraints TEXT,links TEXT,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL). 2) rust: open_db() save_idea_intake get_idea_intake submit_idea_intake. 3) tsx for src/screens/pipeline/Stage1IdeaIntake.tsx: form title/problem/target/constraints/links Save draft+Submit buttons. Output ONLY three blocks. No prose."
$prompts["F-011"] = "$tsRules`n`nI'm building LINUP.IO - Tauri v2 Rust + React/TypeScript.`n`n$rustDb`n`nCONTEXT: Rust src-tauri/src/commands/pipeline/stage2_clarify.rs. DB E:\\linup-io\\linup.db. Max 5 questions. Blocking gate on constraint conflicts.`n`nTASK: Output THREE blocks. 1) sql: CREATE TABLE clarify_sessions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,questions TEXT NOT NULL,answers TEXT,gate_status TEXT NOT NULL DEFAULT pending,created_at TEXT NOT NULL,updated_at TEXT NOT NULL). 2) rust: open_db() start_clarify save_clarify_answers approve_clarify. 3) tsx for src/screens/pipeline/Stage2Clarify.tsx: question list answer inputs conflict display. Output ONLY three blocks. No prose."

function linup-code {
    param(
        [Parameter(Mandatory=$true)][string]$Feature,
        [string]$Task = "",
        [switch]$Interactive,
        [switch]$DryRun
    )

    Set-Location "E:\linup-io"

    try { $null = ollama list 2>&1 }
    catch { Write-Host "X Ollama not running. Start with: ollama serve" -ForegroundColor Red; return }

    $featureKey = $Feature.ToUpper()

    if (-not $prompts.ContainsKey($featureKey)) {
        Write-Host "X No prompt for: $Feature" -ForegroundColor Red
        Write-Host "  Available: $($prompts.Keys -join ', ')" -ForegroundColor Yellow
        return
    }

    if ($featureKey -eq "F-060") { Write-Host "F-060 already complete." -ForegroundColor Green; return }

    $prompt = $prompts[$featureKey]
    if ($Task -ne "") { $prompt = $prompt + "`n`nADDITIONAL CONSTRAINT: $Task" }

    Write-Host ""
    Write-Host "=======================================" -ForegroundColor DarkGray
    Write-Host "  LINUP Coder > $featureKey  [qwen2.5-coder:14b]" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor DarkGray

    if ($Interactive) { $prompt | ollama run qwen2.5-coder:14b; return }

    Write-Host "  Generating..." -ForegroundColor DarkGray
    $output = $prompt | ollama run qwen2.5-coder:14b
    Write-Host $output

    if ($DryRun) { Write-Host "`n[DryRun] Nothing written." -ForegroundColor Yellow; return }

    $cfg = $featureConfig[$featureKey]
    if (-not $cfg) { Write-Host "`nNo file config for $featureKey" -ForegroundColor Yellow; return }

    Write-Host ""
    Write-Host "=== Auto-saving ===" -ForegroundColor DarkGray

    if ($cfg.RustFile) {
        $code = Get-CodeBlock $output "rust"
        if ($code) { Write-LF $cfg.RustFile $code; Write-Host "  OK $($cfg.RustFile)" -ForegroundColor Green }
        else { Write-Host "  WARN: No rust block - save manually" -ForegroundColor Yellow }
    }

    if ($cfg.SqlFile) {
        $code = Get-CodeBlock $output "sql"
        if ($code) { Write-LF $cfg.SqlFile $code; Write-Host "  OK $($cfg.SqlFile)" -ForegroundColor Green }
        else { Write-Host "  WARN: No sql block - save manually" -ForegroundColor Yellow }
    }

    if ($cfg.TsFiles -and $cfg.TsFiles.Count -gt 0) {
        $blocks = @()
        $blocks += [regex]::Matches($output, "(?s)``````typescript\s*\n(.*?)\n\s*``````") | ForEach-Object { $_.Groups[1].Value.Trim() }
        $blocks += [regex]::Matches($output, "(?s)``````tsx\s*\n(.*?)\n\s*``````") | ForEach-Object { $_.Groups[1].Value.Trim() }
        for ($i = 0; $i -lt $cfg.TsFiles.Count; $i++) {
            if ($i -lt $blocks.Count) { Write-LF $cfg.TsFiles[$i] $blocks[$i]; Write-Host "  OK $($cfg.TsFiles[$i])" -ForegroundColor Green }
            else { Write-Host "  WARN: Missing block for $($cfg.TsFiles[$i])" -ForegroundColor Yellow }
        }
    }

    if ($cfg.YamlFile) {
        $code = Get-CodeBlock $output "yaml"
        if ($code) { Write-LF $cfg.YamlFile $code; Write-Host "  OK $($cfg.YamlFile)" -ForegroundColor Green }
    }

    if ($cfg.ShellFile) {
        $code = Get-CodeBlock $output "bash"
        if ($code) { Write-LF $cfg.ShellFile $code; Write-Host "  OK $($cfg.ShellFile)" -ForegroundColor Green }
    }

    if ($cfg.Ps1File) {
        $code = Get-CodeBlock $output "powershell"
        if (-not $code) { $code = Get-CodeBlock $output "ps1" }
        if ($code) { Write-LF $cfg.Ps1File $code; Write-Host "  OK $($cfg.Ps1File)" -ForegroundColor Green }
    }

    if ($cfg.ModFile -and $cfg.ModLine) {
        if ($cfg.ParentMod) { Add-LineIfMissing "src-tauri\src\commands\mod.rs" "pub mod pipeline;" }
        Add-LineIfMissing $cfg.ModFile $cfg.ModLine
    }

    if ($cfg.Commands) { foreach ($cmd in $cfg.Commands) { Add-TauriCommand $cmd } }

    if ($cfg.SqlFile -and $cfg.SqlVersion) {
        Add-Migration $cfg.SqlVersion $cfg.SqlDesc (Split-Path $cfg.SqlFile -Leaf)
    }

    if ($cfg.ExtraCrates) { foreach ($c in $cfg.ExtraCrates) { Add-CrateDep $c } }

    Write-Host ""
    Write-Host "=== Build ===" -ForegroundColor DarkGray

    $hasRust = $cfg.RustFile -or $cfg.Commands
    $hasTs   = $cfg.TsFiles -and $cfg.TsFiles.Count -gt 0

    if ($hasRust) {
        cargo build --manifest-path src-tauri\Cargo.toml
        if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL: cargo build - fix then re-run" -ForegroundColor Red; return }
        Write-Host "  OK: cargo build passed" -ForegroundColor Green
    }

    if ($hasTs) {
        npx tsc --noEmit
        if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL: TypeScript errors - fix then re-run" -ForegroundColor Red; return }
        Write-Host "  OK: TypeScript passed" -ForegroundColor Green
    }

    git add .
    git commit -m "feat: [$featureKey] implementation"
    git push origin main
    Write-Host "  OK: Pushed - Actions build triggered" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor DarkGray
}

Set-Alias lc linup-code
Write-Host "linup-code ready. lc F-003  |  lc F-003 -Interactive  |  lc F-003 -DryRun" -ForegroundColor Green