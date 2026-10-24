import { NumberField, ListField, SettingRow, Toggle } from '../components';
import type { PageProps } from './ctx';

export function RulesPage({ settings, act }: PageProps) {
  const s = settings.search;
  const up = (patch: object): void => void act({ type: 'SETTINGS_UPDATE', patch });
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Rules</h1>
        <p className="muted">
          Fine-tune what gets filtered in Research mode, plus your own hide rules.
        </p>
      </div>
      <section className="card" aria-label="Search rules">
        <h2>Search results</h2>
        <SettingRow
          title="Excluded keywords"
          description="Hide any result whose title, channel or snippet contains one of these. One per line."
        >
          <ListField
            label="Excluded keywords"
            value={s.negativeKeywords}
            placeholder={'reaction\ncompilation'}
            onCommit={(v) => up({ search: { negativeKeywords: v } })}
          />
        </SettingRow>
        <SettingRow
          title="Preferred channels"
          description="Results from channels containing these names get a relevance boost. One per line."
        >
          <ListField
            label="Preferred channels"
            value={s.preferredChannels}
            placeholder="3Blue1Brown"
            onCommit={(v) => up({ search: { preferredChannels: v } })}
          />
        </SettingRow>
        <SettingRow
          title="Hide low-relevance results"
          description="Hides results scoring below the minimum. Scores come from title, channel and snippet text only."
        >
          <Toggle
            label="Hide low-relevance results"
            checked={s.hideIrrelevant}
            onChange={(v) => up({ search: { hideIrrelevant: v } })}
          />
        </SettingRow>
        <SettingRow
          title="Minimum relevance"
          description="0 to 100. Lower values hide less. The FocusTube menu on YouTube can always show filtered results."
        >
          <NumberField
            label="Minimum relevance"
            value={s.minRelevance}
            min={0}
            max={100}
            onCommit={(n) => up({ search: { minRelevance: n } })}
          />
        </SettingRow>
      </section>
      <section className="card" aria-label="Custom hide rules">
        <h2>Custom hide rules</h2>
        <SettingRow
          title="CSS selectors to hide"
          description="One selector per line, for example “ytd-promoted-sparkles-web-renderer”. Elements containing the video player are never hidden. Remove a line to bring the element back."
        >
          <ListField
            label="CSS selectors to hide"
            value={settings.advanced.customHideSelectors}
            placeholder="ytd-merch-shelf-renderer"
            onCommit={(v) => up({ advanced: { customHideSelectors: v } })}
          />
        </SettingRow>
      </section>
    </div>
  );
}
