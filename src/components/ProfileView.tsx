import { SourceView } from './SourceView'
import { profileStyle } from '../lib/profile-style'
import './profile-view.css'

export function ProfileView({ body, style, handle }: { body: string; style?: string; handle?: string }) {
  const selected = profileStyle(style)
  return (
    <div className={`profile-view profile-view--${selected}`} data-profile-style={selected}>
      {selected !== 'source' && (
        <div className="profile-view-label">
          <span>{selected === 'field-guide' ? 'Field notes' : 'Profile / record'}</span>
          {handle && <span>{handle}.md</span>}
        </div>
      )}
      <SourceView body={body} />
    </div>
  )
}
