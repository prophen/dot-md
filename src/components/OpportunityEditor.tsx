import { OPEN_TO, readOpportunities, writeOpportunities, type Opportunities } from '../lib/opportunities'

export function OpportunityEditor({ body, onChange, onError, disabled }: {
  body: string; onChange: (body: string) => void; onError: (message: string) => void; disabled: boolean
}) {
  const { value, error } = readOpportunities(body)
  function update(next: Opportunities) {
    try { onChange(writeOpportunities(body, next)) }
    catch (err) { onError((err as Error).message) }
  }
  return (
    <section className="mb-6 border-y border-border py-4 text-[12px]">
      <h2 className="mb-2">opportunities · optional</h2>
      <p className="mb-3 text-muted-foreground">Choose only what you want to share. These fields edit your Markdown and follow your file’s visibility when saved. No sensitive details needed.</p>
      {error && <p role="alert" className="mb-3 text-mark">{error}</p>}
      <fieldset disabled={disabled || !!error} className="space-y-3 disabled:opacity-50">
        <legend className="mb-2">Open to</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {OPEN_TO.map((choice) => <label key={choice} className="flex items-center gap-2">
            <input type="checkbox" checked={value.openTo.includes(choice)} onChange={(e) => update({ ...value, openTo: e.target.checked ? [...value.openTo, choice] : value.openTo.filter((item) => item !== choice) })} />
            {choice}
          </label>)}
        </div>
        {(['availability', 'workPreferences'] as const).map((field) => <label key={field} className="block">
          <span className="mb-1 block">{field === 'availability' ? 'Availability' : 'Work preferences'}</span>
          <input type="text" value={value[field]} onChange={(e) => update({ ...value, [field]: e.target.value })}
            placeholder={field === 'availability' ? 'e.g. From January, a few hours a week' : 'e.g. Remote, async, or local to me'}
            className="w-full border border-input bg-card px-3 py-2 outline-none focus:border-mark" />
        </label>)}
        <button type="button" onClick={() => update({ openTo: [], availability: '', workPreferences: '' })} className="text-muted-foreground underline underline-offset-2">clear opportunities</button>
      </fieldset>
    </section>
  )
}
