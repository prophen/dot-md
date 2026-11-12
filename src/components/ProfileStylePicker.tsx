import { PROFILE_STYLE_OPTIONS, type ProfileStyle } from '../lib/profile-style'

export function ProfileStylePicker({ value, onChange, disabled = false, help = "Preview below. Save to apply to your profile page. Your Markdown stays the same." }: {
  value: ProfileStyle; onChange: (value: ProfileStyle) => void; disabled?: boolean; help?: string
}) {
  return (
    <fieldset disabled={disabled} className="mb-6 border-y border-border py-4">
      <legend className="px-1 text-[12px]">Profile style</legend>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {PROFILE_STYLE_OPTIONS.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-start gap-2 text-[12px]">
            <input type="radio" name="profile-style" value={option.id} checked={value === option.id}
              onChange={() => onChange(option.id)} className="mt-1 accent-mark" />
            <span><span className="block">{option.name}</span>
              <span className="mt-1 block max-w-52 font-serif text-[14px] text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{help}</p>
    </fieldset>
  )
}
