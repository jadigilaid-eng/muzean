import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  FolderOpen,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { BackupManifest, BackupPayload } from '../domain/backup';
import { resolveTransitionMode } from '../domain/audioMath';
import type {
  AppLanguage,
  AppSettings,
  AppTheme,
  MusicRoot,
  ScanRun,
  TextScale,
  UiScale,
} from '../domain/types';
import { APPLE_SPRING, GlassButton, GlassPanel } from './GlassUI';

interface SettingsViewProps {
  settings: AppSettings;
  musicRoot: MusicRoot | null;
  lastScanRun: ScanRun | null;
  isScanning: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onPickFolderFiles: (files: FileList | File[], folderName: string) => void;
  onPickDirectoryHandle: () => void;
  onManualRescan: () => void;
  onExportBackup: () => Promise<void>;
  onValidateRestoreFile: (file: File) => Promise<{
    valid: boolean;
    error?: string;
    manifest?: BackupManifest;
    payload?: BackupPayload;
  }>;
  onConfirmRestore: (payload: BackupPayload) => void;
  onRunSafeRepair: () => string;
  onResetDatabase: () => void;
  labels: {
    settingsFolderSection: string;
    settingsFolderHint: string;
    chooseFolder: string;
    rescanNow: string;
    scanning: string;
    settingsPlaybackSection: string;
    crossfade: string;
    gapless: string;
    transitionRuleNote: string;
    settingsAppearanceSection: string;
    themeLabel: string;
    themeDark: string;
    themeLight: string;
    languageLabel: string;
    textScaleLabel: string;
    uiScaleLabel: string;
    hapticsLabel: string;
    artworkAccentLabel: string;
    settingsBackupSection: string;
    exportBackup: string;
    restoreBackup: string;
    backupNote: string;
    dbRecoveryTitle: string;
    dbRepairSafe: string;
    dbResetFresh: string;
    cancel: string;
    confirm: string;
  };
}

export function SettingsView({
  settings,
  musicRoot,
  lastScanRun,
  isScanning,
  onUpdateSettings,
  onPickFolderFiles,
  onPickDirectoryHandle,
  onManualRescan,
  onExportBackup,
  onValidateRestoreFile,
  onConfirmRestore,
  onRunSafeRepair,
  onResetDatabase,
  labels,
}: SettingsViewProps) {
  const dirInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    manifest: BackupManifest;
    payload: BackupPayload;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const transition = resolveTransitionMode(
    settings.crossfadeEnabled,
    settings.crossfadeDurationSec,
    settings.gaplessEnabled
  );

  const handleChooseFolderClick = () => {
    if ('showDirectoryPicker' in window) {
      onPickDirectoryHandle();
    } else {
      dirInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Music Source & Manual Rescan */}
      <GlassPanel className="p-4 space-y-3">
        <h2 className="font-neon-script text-xl leading-snug flex items-center gap-2 pr-2">
          <FolderOpen className="w-4 h-4 text-[var(--muzean-accent-2)]" />
          <span>{labels.settingsFolderSection}</span>
        </h2>
        <p className="text-xs text-[var(--muzean-text-muted)]">{labels.settingsFolderHint}</p>

        <div className="glass-inset p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-outrun text-sm font-semibold truncate">
              {musicRoot?.displayName ?? 'No folder selected'}
            </div>
            <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)] truncate">
              {musicRoot?.treeUri ?? '—'} · Status: {musicRoot?.rootStatus ?? 'MISSING'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <GlassButton
              type="button"
              onClick={handleChooseFolderClick}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
            >
              {labels.chooseFolder}
            </GlassButton>
            <GlassButton
              type="button"
              tone="accent"
              disabled={isScanning}
              onClick={onManualRescan}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? labels.scanning : labels.rescanNow}</span>
            </GlassButton>
          </div>
        </div>

        <input
          ref={dirInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is standard in Chromium/WebKit browsers
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              const firstRel = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || '';
              const rootName = firstRel.split('/')[0] || 'Local Music Folder';
              onPickFolderFiles(files, rootName);
            }
          }}
        />

        {lastScanRun && (
          <div className="text-xs font-mono-tabular text-[var(--muzean-text-muted)] flex flex-wrap gap-x-4 gap-y-1">
            <span>Scan: {lastScanRun.status}</span>
            <span>Discovered: {lastScanRun.filesDiscovered}</span>
            <span>Added: {lastScanRun.filesAdded}</span>
            <span>Updated: {lastScanRun.filesUpdated}</span>
            <span>Missing: {lastScanRun.filesMissing}</span>
            <span>Failed: {lastScanRun.filesFailed}</span>
          </div>
        )}
      </GlassPanel>

      {/* 2. Playback Transitions (Crossfade & Gapless) */}
      <GlassPanel className="p-4 space-y-3">
        <h2 className="font-neon-script text-xl leading-snug pr-2">{labels.settingsPlaybackSection}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="flex items-center justify-between gap-2 py-2 border-b sm:border-b-0 sm:border-r border-[var(--muzean-border)] sm:pr-4">
            <div>
              <div className="text-sm font-medium">{labels.crossfade}</div>
              <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                {settings.crossfadeDurationSec}s
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Crossfade duration seconds"
                value={settings.crossfadeDurationSec}
                onChange={(e) =>
                  onUpdateSettings({
                    crossfadeDurationSec: Number(e.target.value) as 3 | 5 | 8 | 10,
                  })
                }
                className="min-h-[38px] px-3 glass-btn text-xs font-mono-tabular"
              >
                {[3, 5, 8, 10].map((sec) => (
                  <option key={sec} value={sec} className="bg-[var(--muzean-bg)]">
                    {sec}s
                  </option>
                ))}
              </select>
              <GlassButton
                type="button"
                role="switch"
                aria-checked={settings.crossfadeEnabled}
                active={settings.crossfadeEnabled}
                tone={settings.crossfadeEnabled ? 'accent' : 'default'}
                onClick={() => onUpdateSettings({ crossfadeEnabled: !settings.crossfadeEnabled })}
                className="min-h-[38px] px-3.5 text-xs font-semibold"
              >
                {settings.crossfadeEnabled ? 'ON' : 'OFF'}
              </GlassButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 py-2">
            <div>
              <div className="text-sm font-medium">{labels.gapless}</div>
              <div className="font-mono-tabular text-xs text-[var(--muzean-text-muted)]">
                Active mode: {transition.mode}
              </div>
            </div>
            <GlassButton
              type="button"
              role="switch"
              aria-checked={settings.gaplessEnabled}
              active={settings.gaplessEnabled}
              tone={settings.gaplessEnabled ? 'teal' : 'default'}
              onClick={() => onUpdateSettings({ gaplessEnabled: !settings.gaplessEnabled })}
              className="min-h-[38px] px-3.5 text-xs font-semibold"
            >
              {settings.gaplessEnabled ? 'ON' : 'OFF'}
            </GlassButton>
          </div>
        </div>

        <p className="text-xs text-[var(--muzean-text-muted)]">{labels.transitionRuleNote}</p>
      </GlassPanel>

      {/* 3. Appearance, Language & Accessibility */}
      <GlassPanel className="p-4 space-y-4">
        <h2 className="font-neon-script text-xl leading-snug pr-2">{labels.settingsAppearanceSection}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="settings-theme" className="block font-medium text-[var(--muzean-text-muted)]">
              {labels.themeLabel}
            </label>
            <select
              id="settings-theme"
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value as AppTheme })}
              className="w-full min-h-[40px] px-3 glass-btn"
            >
              <option value="dark" className="bg-[var(--muzean-bg)]">{labels.themeDark}</option>
              <option value="light" className="bg-[var(--muzean-bg)]">{labels.themeLight}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-lang" className="block font-medium text-[var(--muzean-text-muted)]">
              {labels.languageLabel}
            </label>
            <select
              id="settings-lang"
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value as AppLanguage })}
              className="w-full min-h-[40px] px-3 glass-btn"
            >
              <option value="id" className="bg-[var(--muzean-bg)]">Bahasa Indonesia</option>
              <option value="en" className="bg-[var(--muzean-bg)]">English</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-text-scale" className="block font-medium text-[var(--muzean-text-muted)]">
              {labels.textScaleLabel}
            </label>
            <select
              id="settings-text-scale"
              value={settings.textScale}
              onChange={(e) => onUpdateSettings({ textScale: e.target.value as TextScale })}
              className="w-full min-h-[40px] px-3 glass-btn"
            >
              <option value="small" className="bg-[var(--muzean-bg)]">Small</option>
              <option value="medium" className="bg-[var(--muzean-bg)]">Medium</option>
              <option value="large" className="bg-[var(--muzean-bg)]">Large</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-ui-scale" className="block font-medium text-[var(--muzean-text-muted)]">
              {labels.uiScaleLabel}
            </label>
            <select
              id="settings-ui-scale"
              value={settings.uiScale}
              onChange={(e) => onUpdateSettings({ uiScale: e.target.value as UiScale })}
              className="w-full min-h-[40px] px-3 glass-btn"
            >
              <option value="compact" className="bg-[var(--muzean-bg)]">Compact</option>
              <option value="standard" className="bg-[var(--muzean-bg)]">Standard</option>
              <option value="comfortable" className="bg-[var(--muzean-bg)]">Comfortable</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <GlassButton
            type="button"
            role="switch"
            aria-checked={settings.hapticsEnabled}
            active={settings.hapticsEnabled}
            tone={settings.hapticsEnabled ? 'teal' : 'default'}
            onClick={() => onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
            className="min-h-[40px] px-4 py-1.5 text-xs font-medium flex items-center gap-2"
          >
            <span>{labels.hapticsLabel}:</span>
            <strong>{settings.hapticsEnabled ? 'ON' : 'OFF'}</strong>
          </GlassButton>

          <GlassButton
            type="button"
            role="switch"
            aria-checked={settings.artworkAccentEnabled}
            active={settings.artworkAccentEnabled}
            tone={settings.artworkAccentEnabled ? 'accent' : 'default'}
            onClick={() => onUpdateSettings({ artworkAccentEnabled: !settings.artworkAccentEnabled })}
            className="min-h-[40px] px-4 py-1.5 text-xs font-medium flex items-center gap-2"
          >
            <span>{labels.artworkAccentLabel}:</span>
            <strong>{settings.artworkAccentEnabled ? 'ON' : 'OFF'}</strong>
          </GlassButton>
        </div>
      </GlassPanel>

      {/* 4. Manual ZIP Backup & Restore */}
      <GlassPanel className="p-4 space-y-3">
        <h2 className="font-neon-script text-xl leading-snug flex items-center gap-2 pr-2">
          <Archive className="w-4 h-4 text-[var(--muzean-accent)]" />
          <span>{labels.settingsBackupSection}</span>
        </h2>
        <p className="text-xs text-[var(--muzean-text-muted)]">{labels.backupNote}</p>

        <div className="flex flex-wrap items-center gap-2">
          <GlassButton
            type="button"
            tone="accent"
            onClick={() => void onExportBackup()}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            <span>{labels.exportBackup}</span>
          </GlassButton>

          <GlassButton
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>{labels.restoreBackup}</span>
          </GlassButton>

          <input
            ref={restoreInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRestoreError(null);
              const res = await onValidateRestoreFile(file);
              if (res.valid && res.manifest && res.payload) {
                setRestorePreview({ manifest: res.manifest, payload: res.payload });
              } else {
                setRestoreError(res.error ?? 'Invalid ZIP backup');
              }
              e.target.value = '';
            }}
          />
        </div>

        {restoreError && (
          <div className="glass-inset p-3 border-rose-500/70 text-xs text-rose-500">
            {restoreError}
          </div>
        )}

        {restorePreview && (
          <div className="glass-inset p-3.5 space-y-3 text-xs">
            <div className="font-semibold">
              Backup Preview ({new Date(restorePreview.manifest.createdAt).toLocaleString()})
            </div>
            <div className="font-mono-tabular text-[var(--muzean-text-muted)]">
              Playlists: {restorePreview.manifest.counts.playlists} · EQ Configs:{' '}
              {restorePreview.manifest.counts.eqConfigs} · DAC Profiles:{' '}
              {restorePreview.manifest.counts.dacProfiles} · Lyrics:{' '}
              {restorePreview.manifest.counts.lyrics} · Checksum:{' '}
              {restorePreview.manifest.checksum}
            </div>
            <div className="flex items-center gap-2">
              <GlassButton
                type="button"
                tone="teal"
                onClick={() => {
                  onConfirmRestore(restorePreview.payload);
                  setRestorePreview(null);
                }}
                className="min-h-[38px] px-4 py-1.5 font-semibold"
              >
                {labels.confirm}
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => setRestorePreview(null)}
                className="min-h-[38px] px-4 py-1.5"
              >
                {labels.cancel}
              </GlassButton>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* 5. Database Recovery */}
      <GlassPanel className="p-4 space-y-3">
        <h2 className="font-neon-script text-xl leading-snug flex items-center gap-2 pr-2">
          <Database className="w-4 h-4 text-[var(--muzean-accent-2)]" />
          <span>{labels.dbRecoveryTitle}</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <GlassButton
            type="button"
            onClick={() => setRepairResult(onRunSafeRepair())}
            className="min-h-[40px] px-4 py-1.5 text-xs font-semibold"
          >
            {labels.dbRepairSafe}
          </GlassButton>
          <GlassButton
            type="button"
            tone="danger"
            onClick={() => setResetConfirmOpen(true)}
            className="min-h-[40px] px-4 py-1.5 text-xs font-semibold"
          >
            {labels.dbResetFresh}
          </GlassButton>
        </div>

        {repairResult && (
          <div className="text-xs text-[var(--muzean-accent-2)] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{repairResult}</span>
          </div>
        )}
      </GlassPanel>

      <AnimatePresence>
        {resetConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={APPLE_SPRING}
              className="glass-modal max-w-sm w-full p-5 space-y-4 shadow-none"
            >
              <div className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  Initializing a fresh database will erase custom playlists, history, saved lyrics, and EQ profiles. Audio files in your folder remain untouched.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <GlassButton
                  type="button"
                  onClick={() => setResetConfirmOpen(false)}
                  className="min-h-[38px] px-4 py-1.5 text-xs"
                >
                  {labels.cancel}
                </GlassButton>
                <GlassButton
                  type="button"
                  tone="danger"
                  onClick={() => {
                    onResetDatabase();
                    setResetConfirmOpen(false);
                  }}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-semibold"
                >
                  {labels.confirm}
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
